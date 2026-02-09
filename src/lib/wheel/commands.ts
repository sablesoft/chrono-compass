// src/lib/wheel/commands.ts
import type { Anchors } from './spokes';
import { buildSpokeTimes } from './spokes';
import { ms } from '../format';
import { SHIFT_EPS_MS, sameCycle, nudgeInsideCycle } from './wheel';
import { computeAnchors } from './wheel';

export type NavIntent =
    | { kind: 'jump'; dir: -1 | 1 | 0 }                // small move, direction matters
    | { kind: 'shiftCycle'; dir: -1 | 1 }              // full turn
    | { kind: 'eplus' };                               // always forward full turn, then reset to new cycle E

export type WheelNav = {
    intent: NavIntent;
    // target time to select (final)
    targetTs: number;
    // for shift-cycle: which spoke index to keep on next/prev cycle (0..15)
    carrySpokeIndex?: number;
};

/**
 * Jump to a spoke inside current model (including E_next index 16).
 * If i=16, we treat it as "E+" navigation: forward to next cycle E.
 */
export function cmdJumpToSpoke(
    i: number,
    model: { anchors: Anchors; spokeTimes: number[] },
    selectedTs: number,
    lat: number,
    lon: number,
    kind: any
): WheelNav {
    const t = model.spokeTimes[i];
    if (!Number.isFinite(t)) return { intent: { kind: 'jump', dir: 0 }, targetTs: ms(selectedTs) };

    if (i === 16) {
        // E+ is special: move to next cycle's E
        const endTs = model.anchors.E_next;
        const probe = endTs + SHIFT_EPS_MS;
        const a2 = computeAnchors(kind, probe, lat, lon);
        return { intent: { kind: 'eplus' }, targetTs: ms(a2.E) };
    }

    const dir: -1 | 1 | 0 = t === selectedTs ? 0 : (t > selectedTs ? 1 : -1);
    return { intent: { kind: 'jump', dir }, targetTs: ms(t) };
}

/**
 * Shift whole cycle left/right, keeping current spoke index (nearest in current wheel).
 * This is your old "shiftCycle" but returns a command only.
 */
export function cmdShiftCycle(
    dir: -1 | 1,
    kind: any,
    selectedTs: number,
    lat: number,
    lon: number,
    anchors: Anchors,
    spokeTimes: number[],
    activeIndex: number
): WheelNav {
    const cycleMs0 = Math.max(1, anchors.E_next - anchors.E);

    const edgeStep = Math.max(SHIFT_EPS_MS, Math.floor(cycleMs0 * 0.01));
    const pushStep = Math.max(10 * SHIFT_EPS_MS, Math.floor(cycleMs0 * 0.60));

    let probe = dir > 0 ? anchors.E_next + edgeStep : anchors.E - edgeStep;
    let a2 = computeAnchors(kind, probe, lat, lon);

    for (let attempt = 0; attempt < 8 && sameCycle(a2, anchors); attempt++) {
        probe = ms(probe + dir * pushStep);
        a2 = computeAnchors(kind, probe, lat, lon);
    }

    for (let attempt = 0; attempt < 8; attempt++) {
        if (probe >= a2.E && probe < a2.E_next) break;
        probe = dir > 0 ? a2.E_next + edgeStep : a2.E - edgeStep;
        a2 = computeAnchors(kind, probe, lat, lon);
    }

    const t2 = buildSpokeTimes(a2);
    let targetTs = ms(t2[activeIndex]);
    targetTs = nudgeInsideCycle(targetTs, a2, dir);

    if (Math.abs(targetTs - selectedTs) < 1_000) {
        probe = ms(probe + dir * pushStep);
        a2 = computeAnchors(kind, probe, lat, lon);
        const t3 = buildSpokeTimes(a2);
        targetTs = nudgeInsideCycle(ms(t3[activeIndex]), a2, dir);
    }

    return {
        intent: { kind: 'shiftCycle', dir },
        targetTs,
        carrySpokeIndex: activeIndex
    };
}
