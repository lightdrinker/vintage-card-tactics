// ============================================================
//  VCT - Game State & Core Logic
// ============================================================

let game = {};
let combatInProgress = false;

function initGame() {
    game = {
        round: 1,
        maxRounds: 5,
        playerHP: 10,
        oppHP: 10,
        playerMaxHP: 10,
        oppMaxHP: 10,
        playerMana: 0,
        oppMana: 0,
        dpPerRound: 8,
        playerDP: 8,
        playerHand: [],
        oppAllCards: [],
        playerBoard: [null, null, null],
        oppBoard: [null, null, null],
        selectedCardIdx: -1,
        oppUsedCards: [],
        voidLanes: new Set(),
        skillUsedThisLane: {},
    };
    game.playerHand = buildDeck();
    game.oppAllCards = buildDeck();
    game.playerDP = game.dpPerRound;
    combatInProgress = false;
    clearLog();
    render();
}

function buildDeck() {
    let deck = [];
    for (const elem of ELEMENTS) {
        const cards = CARD_POOL.filter(c => c.elem === elem);
        const shuffled = shuffle([...cards]);
        deck.push(shuffled[0], shuffled[1], shuffled[2]);
    }
    const extra = shuffle([...CARD_POOL]);
    deck.push(extra[0], extra[1], extra[2]);
    return shuffle(deck.map(c => ({
        ...c,
        id: Math.random().toString(36).substr(2, 6)
    })));
}

function prepareRound() {
    game.playerDP = game.dpPerRound;
    game.playerBoard = [null, null, null];
    game.oppBoard = [null, null, null];
    game.selectedCardIdx = -1;
    game.voidLanes = new Set();
    game.skillUsedThisLane = {};
    combatInProgress = false;
    render();
}

function endGame() {
    let title, detail;
    if (game.playerHP <= 0 && game.oppHP <= 0) {
        title = 'DRAW';
        detail = 'Both masters fell!';
    } else if (game.oppHP <= 0) {
        title = 'YOU WIN!';
        detail = `Opponent destroyed! (Your HP: ${Math.max(0, game.playerHP)})`;
    } else if (game.playerHP <= 0) {
        title = 'YOU LOSE';
        detail = `Your master fell! (Opp HP: ${Math.max(0, game.oppHP)})`;
    } else {
        if (game.playerHP > game.oppHP) {
            title = 'YOU WIN!';
            detail = `HP ${game.playerHP} vs ${game.oppHP} - You had more HP!`;
        } else if (game.oppHP > game.playerHP) {
            title = 'YOU LOSE';
            detail = `HP ${game.playerHP} vs ${game.oppHP} - Opponent had more HP!`;
        } else {
            title = 'DRAW';
            detail = `HP ${game.playerHP} vs ${game.oppHP} - Perfectly matched!`;
        }
    }
    document.getElementById('result-text').textContent = title;
    document.getElementById('result-detail').textContent = detail;
    document.getElementById('result-overlay').classList.add('show');
}

function restartGame() {
    document.getElementById('result-overlay').classList.remove('show');
    document.getElementById('btn-combat').disabled = false;
    initGame();
}
