// ============================================================
//  VCT - AI Logic (Fair AI)
// ============================================================

function aiPlaceCards() {
    const usedSet = new Set(game.oppUsedCards);
    let available = game.oppAllCards.filter(c => !usedSet.has(c.id));
    let dp = game.dpPerRound;
    let board = [null, null, null];

    // AI는 플레이어 배치를 모른다.
    // 전략: 속성을 다양하게 배치 + DP 효율적으로 사용
    // 약간의 지능은 있되, 완전 최적화는 아님

    const laneOrder = shuffle([0, 1, 2]);

    for (const lane of laneOrder) {
        const affordable = available.filter(c => c.cost <= dp);
        if (affordable.length === 0) continue;

        // 70% 확률로 "약간 똑똑한" 선택, 30% 완전 랜덤
        let pick;
        if (Math.random() < 0.7) {
            pick = smartPick(affordable, board, available);
        } else {
            pick = affordable[Math.floor(Math.random() * affordable.length)];
        }

        board[lane] = pick;
        dp -= pick.cost;
        available = available.filter(c => c.id !== pick.id);
    }

    game.oppBoard = board;
    for (const c of board) {
        if (c) game.oppUsedCards.push(c.id);
    }
}

// 약간 똑똑한 선택: 이미 놓은 속성과 겹치지 않게 + CP/코스트 밸런스
function smartPick(affordable, currentBoard, allAvailable) {
    const placedElems = new Set(currentBoard.filter(c => c).map(c => c.elem));

    // 속성 다양성 보너스
    let scored = affordable.map(c => {
        let score = 0;
        // 다른 속성이면 보너스
        if (!placedElems.has(c.elem)) score += 3;
        // CP/코스트 효율
        score += (c.cp / c.cost) / 200;
        // 약간의 노이즈
        score += Math.random() * 4;
        return { card: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].card;
}

// ============================================================
//  AI 스킬 사용 판단
// ============================================================

function aiChooseSkill(laneIdx) {
    if (game.oppMana <= 0) return null;

    const aiCard = game.oppBoard[laneIdx];
    const playerCard = game.playerBoard[laneIdx];

    if (!aiCard || !playerCard) return null;

    // 전투 시뮬레이션 (카드 공개 후이므로 정당)
    const matchup = getMatchup(aiCard.elem, playerCard.elem);
    const aiCP = matchup === 'advantage' ? Math.floor(aiCard.cp * 1.5) : aiCard.cp;
    const pMatchup = getMatchup(playerCard.elem, aiCard.elem);
    const pCP = pMatchup === 'advantage' ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;

    const isLosing = aiCP < pCP;
    const isWinning = aiCP > pCP;

    // 지고 있을 때: Shift로 상성 뒤집기
    if (isLosing) {
        for (const elem of ELEMENTS) {
            if (elem === aiCard.elem) continue;
            const newMatchup = getMatchup(elem, playerCard.elem);
            const newCP = newMatchup === 'advantage' ? Math.floor(aiCard.cp * 1.5) : aiCard.cp;
            const newPMatchup = getMatchup(playerCard.elem, elem);
            const newPCP = newPMatchup === 'advantage' ? Math.floor(playerCard.cp * 1.5) : playerCard.cp;
            if (newCP > newPCP) {
                if (Math.random() < 0.5) {
                    return { skillId: 'shift', targetElem: elem };
                }
            }
        }

        // Void: 상대 강카드를 같이 묻기
        if (playerCard.cost >= 3 && Math.random() < 0.4) {
            return { skillId: 'voidSkill' };
        }
    }

    // 이기고 있을 때: Drain (여유 마나 있을 때만)
    if (isWinning && game.oppMana >= 2 && Math.random() < 0.3) {
        return { skillId: 'drain' };
    }

    return null;
}
