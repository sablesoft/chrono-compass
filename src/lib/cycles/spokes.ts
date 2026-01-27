export type Anchors = {
    start: number;
    end: number;

    E: number;
    N: number;
    W: number;
    S: number;

    E_next: number;
};

// 0..16 timestamps (16 == E_next). Индексы соответствуют порядку меток:
// E, ENE, NE, NNE, N, NNW, NW, WNW, W, WSW, SW, SSW, S, SSE, SE, ESE, E+
export function buildSpokeTimes(a: Anchors) {
    const times = new Array<number>(17);

    function fillSegment(startIndex: number, startTs: number, endTs: number) {
        const seg = endTs - startTs;
        for (let k = 0; k <= 4; k++) {
            times[startIndex + k] = startTs + (seg * k) / 4;
        }
    }

    fillSegment(0, a.E, a.N);        // E -> N : 0..4
    fillSegment(4, a.N, a.W);        // N -> W : 4..8
    fillSegment(8, a.W, a.S);        // W -> S : 8..12
    fillSegment(12, a.S, a.E_next);  // S -> E+ : 12..16

    return times;
}

export function nearestSpokeByTime(ts: number, times: number[]) {
    // times length 17, use 0..15
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < 16; i++) {
        const d = Math.abs(ts - times[i]);
        if (d < bestD) {
            bestD = d;
            bestI = i;
        }
    }
    return bestI;
}

export function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
}

export function progressLinear(ts: number, start: number, end: number) {
    const dur = end - start;
    if (dur <= 0) return 0;
    return clamp01((ts - start) / dur);
}
