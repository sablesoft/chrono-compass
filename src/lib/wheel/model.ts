// src/lib/wheel/model.ts
import type { Anchors } from './spokes';
import { buildSpokeTimes } from './spokes';
import { ms } from '../format';

export type WheelModel = {
    anchors: Anchors;
    spokeTimes: number[];     // 0..16 (16 = E_next)
    boundaryTimes: number[];  // 0..15 boundaries between adjacent spokes, last = between ESE and E_next
    cycleMs: number;

    // indices:
    // 0..15 => E..ESE
    // 16    => E_next (highlight when "in the E+ house")
    currentSpokeIndex: number;
};

function wrapIntoCycle(ts0: number, cycleStart: number, cycleMs: number) {
    let x = ts0;
    while (x < cycleStart) x += cycleMs;
    while (x >= cycleStart + cycleMs) x -= cycleMs;
    return ms(x);
}

function midpointInCycle(a: number, b: number, cycleStart: number, cycleMs: number) {
    let b2 = b;
    if (b2 < a) b2 += cycleMs;
    const mid = a + (b2 - a) / 2;
    return wrapIntoCycle(mid, cycleStart, cycleMs);
}

/**
 * Boundary times for 16 houses:
 * 0: between E and ENE
 * ...
 * 14: between SE and ESE
 * 15: between ESE and E_next
 */
export function buildBoundaryTimes(spokeTimes: number[], anchors: Anchors): number[] {
    const cycleMs = Math.max(1, anchors.end - anchors.start);
    const out = new Array<number>(16);

    for (let i = 0; i < 15; i++) {
        out[i] = midpointInCycle(spokeTimes[i], spokeTimes[i + 1], anchors.start, cycleMs);
    }
    // last boundary: ESE (15) -> E_next (16)
    out[15] = midpointInCycle(spokeTimes[15], spokeTimes[16], anchors.start, cycleMs);

    return out;
}

/**
 * Decide which spoke should be "current" for highlight/label:
 * - If we are after the last boundary (ESE->E_next), we show index 16 (E+)
 * - Otherwise nearest among 0..15 by time
 */
export function currentSpokeIndexByTime(ts: number, spokeTimes: number[], boundaryTimes: number[], anchors: Anchors): number {
    const t = ms(ts);

    // E+ house: [boundaryTimes[15], E_next)
    if (t >= boundaryTimes[15] && t < anchors.E_next) return 16;

    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < 16; i++) {
        const d = Math.abs(t - spokeTimes[i]);
        if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
}

export function buildWheelModel(args: {
    anchors: Anchors;
    selectedTs: number;
}): WheelModel {
    const { anchors, selectedTs } = args;

    const spokeTimes = buildSpokeTimes(anchors);        // 0..16
    const boundaryTimes = buildBoundaryTimes(spokeTimes, anchors);
    const cycleMs = Math.max(1, anchors.end - anchors.start);
    const currentSpokeIndex = currentSpokeIndexByTime(selectedTs, spokeTimes, boundaryTimes, anchors);

    return { anchors, spokeTimes, boundaryTimes, cycleMs, currentSpokeIndex };
}