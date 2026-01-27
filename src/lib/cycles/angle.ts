import type { Anchors } from './spokes';
import { clamp01 } from './spokes';

function segProgress(ts: number, a0: number, a1: number) {
    if (a1 === a0) return 0;
    return clamp01((ts - a0) / (a1 - a0));
}

// Универсально: E=0, N=-90, W=-180, S=-270, E_next=-360
export function angleFromAnchors(ts: number, a: Anchors) {
    if (ts < a.N) {
        const p = segProgress(ts, a.E, a.N);
        return -90 * p;
    }
    if (ts < a.W) {
        const p = segProgress(ts, a.N, a.W);
        return -90 - 90 * p;
    }
    if (ts < a.S) {
        const p = segProgress(ts, a.W, a.S);
        return -180 - 90 * p;
    }
    const p = segProgress(ts, a.S, a.E_next);
    return -270 - 90 * p;
}