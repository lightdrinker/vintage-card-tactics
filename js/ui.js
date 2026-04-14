// ============================================================
//  VCT - UI Rendering & Player Actions
// ============================================================

// --- Player Actions ---

function selectCard(idx) {
    if (combatInProgress) return;
    const card = game.playerHand[idx];
    if (card.cost > game.playerDP && !isCardOnBoard(card)) return;
    game.selectedCardIdx = (game.selectedCardIdx === idx) ? -1 : idx;
    renderHand();
}

function isCardOnBoard(card) {
    return game.playerBoard.some(c => c && c.id === card.id);
}

function placeCard(lane) {
    if (combatInProgress) return;
    if (game.selectedCardIdx < 0) {
        if (game.playerBoard[lane]) {
            game.playerDP += game.playerBoard[lane].cost;
            game.playerHand.push(game.playerBoard[lane]);
            game.playerBoard[lane] = null;
            render();
        }
        return;
    }
    const card = game.playerHand[game.selectedCardIdx];
    if (!card) return;

    if (game.playerBoard[lane]) {
        game.playerDP += game.playerBoard[lane].cost;
        game.playerHand.push(game.playerBoard[lane]);
        game.playerBoard[lane] = null;
    }

    if (card.cost > game.playerDP) return;

    game.playerBoard[lane] = card;
    game.playerDP -= card.cost;
    game.playerHand.splice(game.selectedCardIdx, 1);
    game.selectedCardIdx = -1;
    render();
}

function resetPlacements() {
    if (combatInProgress) return;
    for (let i = 0; i < 3; i++) {
        if (game.playerBoard[i]) {
            game.playerDP += game.playerBoard[i].cost;
            game.playerHand.push(game.playerBoard[i]);
            game.playerBoard[i] = null;
        }
    }
    game.selectedCardIdx = -1;
    render();
}

// --- Rendering ---

function render() {
    renderTopBar();
    renderHand();
    renderPlayerBoard();
    renderOppSlots();
    renderOppDeck();
}

function renderTopBar() {
    document.getElementById('round-info').textContent = `Round ${game.round} / ${game.maxRounds}`;
    document.getElementById('player-mana').textContent = `Mana: ${game.playerMana}`;
    document.getElementById('opp-mana').textContent = `Mana: ${game.oppMana}`;
    document.getElementById('dp-info').textContent = `DP: ${game.playerDP} / ${game.dpPerRound}`;
    document.getElementById('hand-label').textContent = `My Cards (${game.playerHand.length})`;

    updateHPBar('player');
    updateHPBar('opp');
}

function updateHPBar(target) {
    const hp = target === 'player' ? game.playerHP : game.oppHP;
    const maxHP = target === 'player' ? game.playerMaxHP : game.oppMaxHP;
    const pct = Math.max(0, (hp / maxHP) * 100);

    const fill = document.getElementById(`${target}-hp-fill`);
    const ghost = document.getElementById(`${target}-hp-ghost`);
    const text = document.getElementById(`${target}-hp-text`);

    if (fill) fill.style.width = pct + '%';
    if (ghost) ghost.style.width = pct + '%';
    if (text) text.textContent = `${Math.max(0, hp)} / ${maxHP}`;
}

function renderHand() {
    const el = document.getElementById('player-hand');
    el.innerHTML = '';
    const sorted = [...game.playerHand].map((c, i) => ({...c, origIdx: i}));
    sorted.sort((a, b) => {
        const elemOrder = { earth: 0, water: 1, fire: 2, sky: 3 };
        if (elemOrder[a.elem] !== elemOrder[b.elem]) return elemOrder[a.elem] - elemOrder[b.elem];
        return b.cp - a.cp;
    });

    sorted.forEach(card => {
        const idx = card.origIdx;
        const canAfford = card.cost <= game.playerDP;
        const div = document.createElement('div');
        const frame = COST_FRAME[card.cost] || 'frame-bronze';
        div.className = `hand-card elem-${card.elem} ${frame} ${game.selectedCardIdx === idx ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}`;
        div.innerHTML = `
            <div class="card-icon">${ELEM_ICON[card.elem]}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-cp">${card.cp}</div>
        `;
        div.onclick = () => selectCard(idx);
        el.appendChild(div);
    });
}

function renderPlayerBoard() {
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`player-slot-${i}`);
        const card = game.playerBoard[i];
        if (card) {
            const f = COST_FRAME[card.cost] || 'frame-bronze';
            slot.innerHTML = `<div class="placed-card elem-${card.elem} ${f}">
                <div class="card-icon">${ELEM_ICON[card.elem]}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-cp">${card.cp}</div>
            </div>`;
        } else {
            slot.innerHTML = 'Drop here';
        }
    }
}

function renderOppSlots() {
    for (let i = 0; i < 3; i++) {
        document.getElementById(`opp-slot-${i}`).innerHTML = '?';
    }
}

function renderSingleOppSlot(i, card) {
    const slot = document.getElementById(`opp-slot-${i}`);
    if (card) {
        const f = COST_FRAME[card.cost] || 'frame-bronze';
        slot.innerHTML = `<div class="placed-card elem-${card.elem} ${f}">
            <div class="card-icon">${ELEM_ICON[card.elem]}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-cp">${card.cp}</div>
        </div>`;
    } else {
        slot.innerHTML = '<span style="color:#ff6b6b;">EMPTY</span>';
    }
}

function renderOppDeck() {
    const el = document.getElementById('opp-deck');
    const usedSet = new Set(game.oppUsedCards);
    el.innerHTML = '';
    const sorted = [...game.oppAllCards].sort((a, b) => {
        const elemOrder = { earth: 0, water: 1, fire: 2, sky: 3 };
        if (elemOrder[a.elem] !== elemOrder[b.elem]) return elemOrder[a.elem] - elemOrder[b.elem];
        return b.cp - a.cp;
    });
    sorted.forEach(card => {
        const div = document.createElement('div');
        const f = COST_FRAME[card.cost] || 'frame-bronze';
        div.className = `opp-deck-card elem-${card.elem} ${f} ${usedSet.has(card.id) ? 'used' : ''}`;
        div.innerHTML = `
            <div class="card-icon">${ELEM_ICON[card.elem]}</div>
            <div class="card-cp">${card.cp}</div>
        `;
        el.appendChild(div);
    });
}

let oppDeckVisible = true;
function toggleOppDeck() {
    oppDeckVisible = !oppDeckVisible;
    document.getElementById('opp-deck').style.display = oppDeckVisible ? 'flex' : 'none';
}

// --- Combat Log ---

function clearLog() {
    document.getElementById('combat-log').innerHTML = '';
}

function addLog(text, cls) {
    const el = document.getElementById('combat-log');
    el.innerHTML += `<div class="log-entry ${cls}">${text}</div>`;
    el.scrollTop = el.scrollHeight;
}
