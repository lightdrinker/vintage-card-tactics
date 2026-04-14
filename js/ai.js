// ============================================================
//  VCT - AI Logic (Reactive AI)
// ============================================================

function aiPlaceCards() {
    const usedSet = new Set(game.oppUsedCards);
    let available = game.oppAllCards.filter(c => !usedSet.has(c.id));
    let dp = game.dpPerRound;

    // 플레이어 배치 분석
    const playerCards = game.playerBoard;
    const lanes = [0, 1, 2];

    // 각 레인별 최적 카드 후보를 점수로 평가
    let bestPlan = null;
    let bestScore = -Infinity;

    // 가능한 배치 조합을 탐색 (greedy + scoring)
    const plans = generatePlans(available, dp, playerCards);

    for (const plan of plans) {
        const score = evaluatePlan(plan, playerCards);
        if (score > bestScore) {
            bestScore = score;
            bestPlan = plan;
        }
    }

    // fallback: 아무 계획도 못 세우면 랜덤
    if (!bestPlan) {
        bestPlan = [null, null, null];
    }

    game.oppBoard = bestPlan;
    for (const c of bestPlan) {
        if (c) game.oppUsedCards.push(c.id);
    }
}

// --- 배치 조합 생성 (greedy 방식, 모든 순열은 비용이 크므로 레인 우선순위별 탐색) ---
function generatePlans(available, dp, playerCards) {
    const plans = [];
    const laneOrders = [
        [0, 1, 2], [0, 2, 1], [1, 0, 2],
        [1, 2, 0], [2, 0, 1], [2, 1, 0]
    ];

    for (const order of laneOrders) {
        // 전략 1: 각 레인에 최고 점수 카드 배치
        const plan = greedyPick(available, dp, playerCards, order, 'best');
        plans.push(plan);

        // 전략 2: 카운터 우선 (상성 유리한 카드 우선)
        const plan2 = greedyPick(available, dp, playerCards, order, 'counter');
        plans.push(plan2);

        // 전략 3: 효율 우선 (낮은 코스트로 빈 레인 노리기)
        const plan3 = greedyPick(available, dp, playerCards, order, 'efficient');
        plans.push(plan3);
    }

    // 전략 4: 의도적으로 1~2레인 비우기 (DP 집중)
    for (let skip = 0; skip < 3; skip++) {
        const focusLanes = [0, 1, 2].filter(l => l !== skip);
        const plan = greedyPick(available, dp, playerCards, focusLanes, 'best');
        plans.push(plan);
    }

    return plans;
}

function greedyPick(available, dp, playerCards, laneOrder, strategy) {
    let board = [null, null, null];
    let remainDP = dp;
    let used = new Set();

    for (const lane of laneOrder) {
        const affordable = available.filter(c => c.cost <= remainDP && !used.has(c.id));
        if (affordable.length === 0) continue;

        let scored;
        if (strategy === 'counter') {
            scored = affordable.map(c => ({
                card: c,
                score: scoreCardForLane(c, playerCards[lane], 'counter')
            }));
        } else if (strategy === 'efficient') {
            scored = affordable.map(c => ({
                card: c,
                score: scoreCardForLane(c, playerCards[lane], 'efficient')
            }));
        } else {
            scored = affordable.map(c => ({
                card: c,
                score: scoreCardForLane(c, playerCards[lane], 'best')
            }));
        }

        scored.sort((a, b) => b.score - a.score);

        // 약간의 랜덤성: 상위 2개 중 택 1 (70/30)
        if (scored.length > 1 && Math.random() < 0.3) {
            board[lane] = scored[1].card;
        } else {
            board[lane] = scored[0].card;
        }

        remainDP -= board[lane].cost;
        used.add(board[lane].id);
    }

    return board;
}

// --- 개별 카드-레인 점수 ---
function scoreCardForLane(card, playerCard, strategy) {
    let score = 0;

    if (!playerCard) {
        // 빈 레인 → 아무 카드나 놓으면 2HP 데미지
        if (strategy === 'efficient') {
            // 효율 전략: 싼 카드로 빈 레인 때리기
            score = 20 - card.cost * 3;
        } else {
            // 빈 레인에 가장 싼 카드
            score = 10 - card.cost * 2;
        }
        return score;
    }

    // 상성 판정
    const matchup = getMatchup(card.elem, playerCard.elem);
    const effectiveCP = matchup === 'advantage' ? Math.floor(card.cp * 1.5) : card.cp;
    const playerCP = getMatchup(playerCard.elem, card.elem) === 'advantage'
        ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;

    if (strategy === 'counter') {
        // 카운터 전략: 상성 유리 + 이길 수 있는지
        if (matchup === 'advantage') score += 15;
        if (effectiveCP > playerCP) score += 10;
        else if (effectiveCP === playerCP) score += 2;
        else score -= 5;
        score -= card.cost; // 코스트 효율도 고려
    } else if (strategy === 'efficient') {
        // 효율 전략: 코스트 대비 승리 가능성
        if (effectiveCP > playerCP) score += 12;
        else if (effectiveCP === playerCP) score += 3;
        else score -= 8;
        score -= card.cost * 2;
        if (matchup === 'advantage') score += 5;
    } else {
        // best 전략: 종합 판단
        if (effectiveCP > playerCP) score += 12;
        else if (effectiveCP === playerCP) score += 2;
        else score -= 6;
        if (matchup === 'advantage') score += 8;
        if (matchup === 'disadvantage') score -= 4;
        score += card.cp / 200; // 높은 CP 살짝 선호
        score -= card.cost; // 코스트 효율
    }

    return score;
}

// --- 전체 배치 계획 평가 ---
function evaluatePlan(plan, playerCards) {
    let score = 0;
    let totalCost = 0;

    for (let i = 0; i < 3; i++) {
        const aiCard = plan[i];
        const playerCard = playerCards[i];

        if (!aiCard && !playerCard) {
            // 양쪽 빈 레인 — 중립
            score += 0;
        } else if (!aiCard && playerCard) {
            // 내가 비웠는데 상대가 있음 → -2HP 맞음
            score -= 12;
        } else if (aiCard && !playerCard) {
            // 빈 레인 공격 → +2HP 데미지
            score += 10;
            totalCost += aiCard.cost;
        } else {
            // 전투 시뮬레이션
            const matchup = getMatchup(aiCard.elem, playerCard.elem);
            const aiCP = matchup === 'advantage' ? Math.floor(aiCard.cp * 1.5) : aiCard.cp;
            const pMatchup = getMatchup(playerCard.elem, aiCard.elem);
            const pCP = pMatchup === 'advantage' ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;

            if (aiCP > pCP) {
                score += 8 + (matchup === 'advantage' ? 3 : 0);
            } else if (aiCP === pCP) {
                score += 1; // 무승부는 약간 이득 (상대 카드도 소모)
            } else {
                score -= 6;
            }
            totalCost += aiCard.cost;
        }
    }

    // DP 효율 보너스: 적게 쓰고 많이 이기면 좋음
    const dpSaved = game.dpPerRound - totalCost;
    score += dpSaved * 0.5;

    // 라운드 후반에는 공격적으로
    if (game.round >= 4) {
        score += totalCost * 0.3;
    }

    return score;
}

// ============================================================
//  AI 스킬 사용 판단
// ============================================================

function aiChooseSkill(laneIdx) {
    if (game.oppMana <= 0) return null;

    const aiCard = game.oppBoard[laneIdx];
    const playerCard = game.playerBoard[laneIdx];

    // 양쪽 다 비었으면 스킬 불필요
    if (!aiCard && !playerCard) return null;
    // AI 카드가 없으면 스킬 쓸 대상 없음
    if (!aiCard) return null;
    // 플레이어가 빈 레인이면 이미 이기니까 패스
    if (!playerCard) return null;

    // 전투 시뮬레이션
    const matchup = getMatchup(aiCard.elem, playerCard.elem);
    const aiCP = matchup === 'advantage' ? Math.floor(aiCard.cp * 1.5) : aiCard.cp;
    const pMatchup = getMatchup(playerCard.elem, aiCard.elem);
    const pCP = pMatchup === 'advantage' ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;

    const isLosing = aiCP < pCP;
    const isWinning = aiCP > pCP;
    const isTie = aiCP === pCP;

    // 지고 있을 때: Shift로 상성 뒤집기 시도
    if (isLosing || isTie) {
        for (const elem of ELEMENTS) {
            if (elem === aiCard.elem) continue;
            const newMatchup = getMatchup(elem, playerCard.elem);
            const newCP = newMatchup === 'advantage' ? Math.floor(aiCard.cp * 1.5) : aiCard.cp;
            const newPMatchup = getMatchup(playerCard.elem, elem);
            const newPCP = newPMatchup === 'advantage' ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;
            if (newCP > newPCP) {
                if (Math.random() < 0.6) {
                    return { skillId: 'shift', targetElem: elem };
                }
            }
        }

        // Shift로도 못 이기면: Void 사용 (상대가 강카드일 때)
        if (playerCard.cost >= 3 && Math.random() < 0.5) {
            return { skillId: 'voidSkill' };
        }
    }

    // 이기고 있을 때: Drain으로 HP 흡수 (여유 마나가 있을 때)
    if (isWinning && game.oppMana >= 2 && Math.random() < 0.4) {
        return { skillId: 'drain' };
    }

    return null;
}
