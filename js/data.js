// ============================================================
//  VCT - Card Data & Constants
// ============================================================

const ELEMENTS = ['earth', 'water', 'fire', 'sky'];

// 상성 순환: earth > water > fire > sky > earth
const ADVANTAGE = { earth: 'water', water: 'fire', fire: 'sky', sky: 'earth' };

// 속성 아이콘
const ELEM_ICON = { earth: '⛰️', water: '💧', fire: '🔥', sky: '🌪️' };

// 속성 한글명
const ELEM_NAME = { earth: 'EARTH', water: 'WATER', fire: 'FIRE', sky: 'SKY' };

// 코스트별 프레임 등급
const COST_FRAME = { 1: 'frame-bronze', 2: 'frame-silver', 3: 'frame-gold', 4: 'frame-rainbow' };

// 마스터 스킬 정의
var SKILLS = {
    shift: {
        id: 'shift',
        name: 'Elemental Shift',
        icon: '🔄',
        manaCost: 1,
        desc: '해당 레인 카드의 속성을 변경한다',
        needsTarget: true,  // 속성 선택 필요
    },
    voidSkill: {
        id: 'voidSkill',
        name: 'Void',
        icon: '🕳️',
        manaCost: 1,
        desc: '해당 레인 전투를 취소하고 양쪽 카드 모두 파괴',
        needsTarget: false,
    },
    drain: {
        id: 'drain',
        name: 'Drain',
        icon: '🩸',
        manaCost: 1,
        desc: '이번 레인 승리 시 HP 1 회복',
        needsTarget: false,
    },
};

function getMatchup(a, b) {
    if (a === b) return 'neutral';
    if (ADVANTAGE[a] === b) return 'advantage';
    return 'disadvantage';
}

// 카드 풀 (16종: 4속성 x 4등급)
const CARD_POOL = [
    // Earth
    { name: 'Golem',      elem: 'earth', cp: 1400, cost: 4 },
    { name: 'Treant',     elem: 'earth', cp: 1000, cost: 3 },
    { name: 'Gnome',      elem: 'earth', cp: 600,  cost: 2 },
    { name: 'Mole',       elem: 'earth', cp: 300,  cost: 1 },
    // Water
    { name: 'Kraken',     elem: 'water', cp: 1400, cost: 4 },
    { name: 'Siren',      elem: 'water', cp: 1000, cost: 3 },
    { name: 'Undine',     elem: 'water', cp: 600,  cost: 2 },
    { name: 'Sprite',     elem: 'water', cp: 300,  cost: 1 },
    // Fire
    { name: 'Dragon',     elem: 'fire',  cp: 1400, cost: 4 },
    { name: 'Ifrit',      elem: 'fire',  cp: 1000, cost: 3 },
    { name: 'Salamander', elem: 'fire',  cp: 600,  cost: 2 },
    { name: 'Imp',        elem: 'fire',  cp: 300,  cost: 1 },
    // Sky
    { name: 'Phoenix',    elem: 'sky',   cp: 1400, cost: 4 },
    { name: 'Griffin',    elem: 'sky',   cp: 1000, cost: 3 },
    { name: 'Sylph',      elem: 'sky',   cp: 600,  cost: 2 },
    { name: 'Fairy',      elem: 'sky',   cp: 300,  cost: 1 },
];
