// ============================================================
//  VCT - Utility Functions
// ============================================================

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
