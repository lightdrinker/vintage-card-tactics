// ============================================================
//  VCT - Combat Resolution & Animation
// ============================================================

async function startCombat() {
    if (combatInProgress) return;
    combatInProgress = true;
    document.getElementById('btn-combat').disabled = true;

    aiPlaceCards();

    // 상대 카드 공개
    for (let i = 0; i < 3; i++) {
        renderSingleOppSlot(i, game.oppBoard[i]);
    }
    await delay(500);

    // 레인별 순차 전투 (스킬 단계 포함)
    const results = [];
    for (let i = 0; i < 3; i++) {
        // --- 스킬 선택 단계 ---
        const canUseSkill = game.playerMana > 0 && game.playerBoard[i] !== null;
        const aiSkill = aiChooseSkill(i);

        if (canUseSkill) {
            const playerSkill = await showSkillChoice(i);
            if (playerSkill) {
                await applySkill(playerSkill, i, 'player');
            }
        }

        // AI 스킬 적용
        if (aiSkill) {
            await applySkill(aiSkill, i, 'opp');
        }

        // --- 전투 ---
        const result = await resolveLane(i);
        results.push(result);

        // Drain 체크: 승리한 쪽이 Drain을 썼으면 HP 1 회복
        if (result.winner) {
            const drainUser = game.skillUsedThisLane && game.skillUsedThisLane[i];
            if (drainUser && drainUser.skillId === 'drain' && drainUser.side === result.winner) {
                if (result.winner === 'player') {
                    game.playerHP = Math.min(game.playerMaxHP, game.playerHP + 1);
                    addLog(`  ↳ Drain! Player recovers 1 HP`, 'log-win');
                } else {
                    game.oppHP = Math.min(game.oppMaxHP, game.oppHP + 1);
                    addLog(`  ↳ Drain! Opponent recovers 1 HP`, 'log-lose');
                }
                updateHPBar(result.winner === 'player' ? 'player' : 'opp');
            }
        }
    }

    // 투사체 발사
    await delay(300);
    await fireProjectiles(results);

    // 사용한 카드 핸드에서 제거
    for (let i = 0; i < 3; i++) {
        if (game.playerBoard[i]) {
            game.playerHand = game.playerHand.filter(c => c.id !== game.playerBoard[i].id);
        }
    }

    renderTopBar();
    renderOppDeck();

    // 승패 체크
    if (game.playerHP <= 0 || game.oppHP <= 0 || game.round >= game.maxRounds) {
        await delay(600);
        endGame();
        return;
    }

    // 다음 라운드
    await delay(600);
    game.round++;
    game.skillUsedThisLane = {};
    addLog(`--- Round ${game.round} ---`, '');
    prepareRound();
    document.getElementById('btn-combat').disabled = false;
}

// ============================================================
//  스킬 선택 UI (Promise 기반)
// ============================================================

function showSkillChoice(laneIdx) {
    return new Promise(resolve => {
        const overlay = document.getElementById('skill-overlay');
        const laneInfo = document.getElementById('skill-lane-info');
        const btnContainer = document.getElementById('skill-buttons');
        const manaDisplay = document.getElementById('skill-mana-display');

        laneInfo.textContent = `Lane ${laneIdx + 1} 전투 전`;
        manaDisplay.textContent = `Mana: ${game.playerMana}`;

        // 레인 하이라이트
        document.getElementById(`lane-${laneIdx}`).classList.add('lane-active');

        btnContainer.innerHTML = '';

        // 스킬 버튼 생성
        for (const key of Object.keys(SKILLS)) {
            const skill = SKILLS[key];
            const btn = document.createElement('button');
            const canAfford = game.playerMana >= skill.manaCost;
            btn.className = `skill-btn skill-${key} ${!canAfford ? 'disabled' : ''}`;
            btn.innerHTML = `
                <span class="skill-icon">${skill.icon}</span>
                <span class="skill-name">${skill.name}</span>
                <span class="skill-cost">Mana ${skill.manaCost}</span>
            `;
            if (canAfford) {
                btn.onclick = () => {
                    if (skill.needsTarget) {
                        // 속성 선택 서브메뉴
                        showElementPicker(laneIdx, skill, overlay, resolve);
                    } else {
                        overlay.classList.remove('show');
                        document.getElementById(`lane-${laneIdx}`).classList.remove('lane-active');
                        resolve({ skillId: key });
                    }
                };
            }
            btnContainer.appendChild(btn);
        }

        // Skip 버튼
        const skipBtn = document.createElement('button');
        skipBtn.className = 'skill-btn skill-skip';
        skipBtn.innerHTML = `
            <span class="skill-icon">⏭️</span>
            <span class="skill-name">Skip</span>
            <span class="skill-cost"></span>
        `;
        skipBtn.onclick = () => {
            overlay.classList.remove('show');
            document.getElementById(`lane-${laneIdx}`).classList.remove('lane-active');
            resolve(null);
        };
        btnContainer.appendChild(skipBtn);

        overlay.classList.add('show');
    });
}

function showElementPicker(laneIdx, skill, overlay, resolve) {
    const btnContainer = document.getElementById('skill-buttons');
    btnContainer.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'elem-picker-label';
    label.textContent = '변경할 속성을 선택하세요';
    btnContainer.appendChild(label);

    for (const elem of ELEMENTS) {
        const btn = document.createElement('button');
        btn.className = `skill-btn elem-pick elem-${elem}`;
        btn.innerHTML = `
            <span class="skill-icon">${ELEM_ICON[elem]}</span>
            <span class="skill-name">${ELEM_NAME[elem]}</span>
        `;
        btn.onclick = () => {
            overlay.classList.remove('show');
            document.getElementById(`lane-${laneIdx}`).classList.remove('lane-active');
            resolve({ skillId: skill.id, targetElem: elem });
        };
        btnContainer.appendChild(btn);
    }

    // 뒤로가기
    const backBtn = document.createElement('button');
    backBtn.className = 'skill-btn skill-skip';
    backBtn.innerHTML = `<span class="skill-icon">↩️</span><span class="skill-name">Back</span>`;
    backBtn.onclick = () => {
        showSkillChoice(laneIdx).then(resolve);
    };
    btnContainer.appendChild(backBtn);
}

// ============================================================
//  스킬 효과 적용
// ============================================================

async function applySkill(skillData, laneIdx, side) {
    const skill = SKILLS[skillData.skillId];
    const laneName = `Lane ${laneIdx + 1}`;
    const sideLabel = side === 'player' ? 'Player' : 'Opponent';

    // 마나 소모
    if (side === 'player') {
        game.playerMana -= skill.manaCost;
    } else {
        game.oppMana -= skill.manaCost;
    }

    // 스킬별 효과
    if (skillData.skillId === 'shift') {
        const card = side === 'player' ? game.playerBoard[laneIdx] : game.oppBoard[laneIdx];
        if (card) {
            const oldElem = card.elem;
            card.elem = skillData.targetElem;
            addLog(`⚡ ${sideLabel} uses Shift! ${card.name}: ${ELEM_NAME[oldElem]} → ${ELEM_NAME[skillData.targetElem]}`, 'log-skill');
            // 보드 카드 비주얼 업데이트
            if (side === 'player') {
                renderPlayerBoard();
            } else {
                renderSingleOppSlot(laneIdx, card);
            }
            await delay(600);
        }
    } else if (skillData.skillId === 'voidSkill') {
        addLog(`⚡ ${sideLabel} uses Void on ${laneName}! Both cards destroyed`, 'log-skill');
        // void 표시용 — resolveLane에서 처리
        if (!game.voidLanes) game.voidLanes = new Set();
        game.voidLanes.add(laneIdx);
        await delay(600);
    } else if (skillData.skillId === 'drain') {
        addLog(`⚡ ${sideLabel} uses Drain on ${laneName}`, 'log-skill');
        if (!game.skillUsedThisLane) game.skillUsedThisLane = {};
        game.skillUsedThisLane[laneIdx] = { skillId: 'drain', side: side };
        await delay(400);
    }

    renderTopBar();
}

// ============================================================
//  레인 전투 해결
// ============================================================

async function resolveLane(i) {
    const pc = game.playerBoard[i];
    const oc = game.oppBoard[i];
    const laneName = `Lane ${i + 1}`;
    const laneEl = document.getElementById(`lane-${i}`);
    const vsEl = document.getElementById(`vs-${i}`);
    const clashText = document.getElementById(`clash-text-${i}`);
    const playerSlot = document.getElementById(`player-slot-${i}`);
    const oppSlot = document.getElementById(`opp-slot-${i}`);

    laneEl.classList.add('lane-active');
    await delay(300);

    let result = { lane: i, winner: null, loser: null, damage: 0, target: null, elem: null };

    // Void 체크
    if (game.voidLanes && game.voidLanes.has(i)) {
        const myCard = playerSlot.querySelector('.placed-card');
        const oppCard = oppSlot.querySelector('.placed-card');
        if (myCard) myCard.classList.add('draw-fade');
        if (oppCard) oppCard.classList.add('draw-fade');
        showClashResult(clashText, 'VOID', 'tie');
        addLog(`${laneName}: Void — both cards destroyed, no damage`, 'log-draw');
        await delay(700);

        laneEl.classList.remove('lane-active');
        vsEl.classList.remove('clash-active');
        hideClashResult(clashText);
        await delay(150);
        return result;
    }

    if (!pc && !oc) {
        showClashResult(clashText, 'PASS', 'draw');
        addLog(`${laneName}: Both empty - no action`, 'log-draw');
        await delay(500);
    } else if (!pc && oc) {
        vsEl.classList.add('clash-active');
        const oppCard = oppSlot.querySelector('.placed-card');
        if (oppCard) oppCard.classList.add('clash-up');
        await delay(400);
        showClashResult(clashText, 'OPEN!', 'lose');
        addLog(`${laneName}: ${oc.name} hits empty lane! Player -2 HP`, 'log-lose');
        result = { lane: i, winner: 'opp', damage: 2, target: 'player', elem: oc.elem, slotId: `opp-slot-${i}` };
        await delay(500);
    } else if (pc && !oc) {
        vsEl.classList.add('clash-active');
        const myCard = playerSlot.querySelector('.placed-card');
        if (myCard) myCard.classList.add('clash-down');
        await delay(400);
        showClashResult(clashText, 'OPEN!', 'win');
        addLog(`${laneName}: ${pc.name} hits empty lane! Opponent -2 HP`, 'log-win');
        result = { lane: i, winner: 'player', damage: 2, target: 'opp', elem: pc.elem, slotId: `player-slot-${i}` };
        await delay(500);
    } else {
        result = await resolveClash(i, pc, oc, laneName, vsEl, clashText, playerSlot, oppSlot);
    }

    // 레인 정리
    vsEl.classList.remove('clash-active');
    vsEl.textContent = 'VS';
    laneEl.classList.remove('lane-active');
    hideClashResult(clashText);
    await delay(150);

    return result;
}

async function resolveClash(i, pc, oc, laneName, vsEl, clashText, playerSlot, oppSlot) {
    let pCP = pc.cp;
    let oCP = oc.cp;
    const pMatchup = getMatchup(pc.elem, oc.elem);
    const oMatchup = getMatchup(oc.elem, pc.elem);
    if (pMatchup === 'advantage') pCP = Math.floor(pCP * 1.5);
    if (oMatchup === 'advantage') oCP = Math.floor(oCP * 1.5);

    // 충돌 모션
    vsEl.classList.add('clash-active');
    vsEl.textContent = 'CLASH!';
    const myCard = playerSlot.querySelector('.placed-card');
    const oppCard = oppSlot.querySelector('.placed-card');
    if (myCard) myCard.classList.add('clash-down');
    if (oppCard) oppCard.classList.add('clash-up');
    await delay(600);

    const detail = `${pc.name}(${pCP}) vs ${oc.name}(${oCP})`;

    if (pCP > oCP) {
        if (oppCard) oppCard.classList.add('fade-lose');
        if (myCard) myCard.classList.add('victory-glow');
        showClashResult(clashText, 'WIN!', 'win');
        addLog(`${laneName}: ${detail} -> Player wins! Opp -1 HP`, 'log-win');
        await delay(700);
        return { lane: i, winner: 'player', damage: 1, target: 'opp', elem: pc.elem, slotId: `player-slot-${i}` };
    } else if (oCP > pCP) {
        if (myCard) myCard.classList.add('fade-lose');
        if (oppCard) oppCard.classList.add('victory-glow');
        showClashResult(clashText, 'LOSE', 'lose');
        addLog(`${laneName}: ${detail} -> Opponent wins! Player -1 HP`, 'log-lose');
        await delay(700);
        return { lane: i, winner: 'opp', damage: 1, target: 'player', elem: oc.elem, slotId: `opp-slot-${i}` };
    } else {
        if (myCard) myCard.classList.add('draw-fade');
        if (oppCard) oppCard.classList.add('draw-fade');
        showClashResult(clashText, 'TIE', 'tie');
        addLog(`${laneName}: ${detail} -> Tie! Both destroyed`, 'log-draw');
        await delay(700);
        return { lane: i, winner: null, damage: 0, target: null, elem: null };
    }
}

// ============================================================
//  투사체 시스템
// ============================================================

async function fireProjectiles(results) {
    const projectiles = results.filter(r => r.winner && r.damage > 0);
    if (projectiles.length === 0) return;
    for (const result of projectiles) {
        await fireOneProjectile(result);
        await delay(200);
    }
}

async function fireOneProjectile(result) {
    const sourceSlot = document.getElementById(result.slotId);
    const targetMaster = document.getElementById(result.target === 'player' ? 'player-master' : 'opp-master');
    if (!sourceSlot || !targetMaster) return;

    const card = sourceSlot.querySelector('.placed-card');
    if (card) {
        card.classList.remove('victory-glow');
        card.classList.add('to-orb');
        await delay(400);
    }

    const sourceRect = sourceSlot.getBoundingClientRect();
    const targetRect = targetMaster.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    const proj = document.createElement('div');
    proj.className = `projectile elem-${result.elem}`;
    proj.style.left = startX + 'px';
    proj.style.top = startY + 'px';
    document.getElementById('projectile-container').appendChild(proj);

    const duration = 400;
    const startTime = performance.now();

    await new Promise(resolve => {
        function animate(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const ease = t * t;
            const x = startX + (endX - startX) * ease;
            const y = startY + (endY - startY) * ease;
            const arc = Math.sin(t * Math.PI) * -30;
            proj.style.left = x + 'px';
            proj.style.top = (y + arc) + 'px';
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(animate);
    });

    proj.classList.add('explode');
    targetMaster.classList.add('hp-hit', 'hp-flash');

    if (result.target === 'player') {
        game.playerHP = Math.max(0, game.playerHP - result.damage);
        game.oppMana += 1;
    } else {
        game.oppHP = Math.max(0, game.oppHP - result.damage);
        game.playerMana += 1;
    }

    updateHPBar(result.target);
    const hpText = document.getElementById(`${result.target}-hp-text`);
    if (hpText) hpText.classList.add('hp-change');

    await delay(500);

    targetMaster.classList.remove('hp-hit', 'hp-flash');
    if (hpText) hpText.classList.remove('hp-change');
    proj.remove();
    sourceSlot.innerHTML = '';
}

// ============================================================
//  Helper
// ============================================================

function showClashResult(el, text, type) {
    el.textContent = text;
    el.className = `clash-text show ${type}`;
}

function hideClashResult(el) {
    el.className = 'clash-text';
}
