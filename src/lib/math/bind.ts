// src/lib/math/bind.ts
//
// Unified Bind wheel solver (distance-linear) for focus ∈ {Sun, Earth}.
//
// New (adult) approach:
// 1) Use ONLY meta.cycleDuration (ms).
// 2) Find the two nearest opposite extrema that bracket ts (“обнимашки”) using 3 windows of ~1/3 cycle.
// 3) Keep the old “cell” logic: find boundary (mid-distance on min->max arc), decide which cycle ts belongs to,
//    then resolve 5 key points: E, N, W, S, E+ and build 17 spokes.
//
// Notes:
// - We do NOT trust extrema finder “kind” for long/flat curves. We always re-classify extrema by sampling f(t±dt).
// - All search params (window/step/eps) are derived from cycleDuration.

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { ObjId } from '../catalog';
import type { SpokeKey } from '../wheel/types';
import { SPOKES_ORDER } from '../wheel/types';

import { findExtremumInWindowGold, fmt} from './extrema';
import { vectorLengthSafe } from './vector';
import {AU_KM, DAY_MS, isFiniteNumber, lerp} from './helpers';

export type BindMeta = {
    distanceAu: number;
    distanceKm: number;
};

type Ext = { t: number; v: number };

function toEngineBody(id: ObjId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function clamp(x: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, x));
}

function nearEq(a: number, b: number, epsAbs: number, epsRel: number) {
    const d = Math.abs(a - b);
    const s = Math.max(1, Math.abs(a), Math.abs(b));
    return d <= Math.max(epsAbs, epsRel * s);
}

function formatCycleDurationTag(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    let leftMin = Math.round(ms / 60_000);
    const MIN_PER_HOUR = 60;
    const MIN_PER_DAY = 24 * MIN_PER_HOUR;
    const MIN_PER_MONTH = 30 * MIN_PER_DAY;
    const MIN_PER_YEAR = 365 * MIN_PER_DAY;

    const year = Math.floor(leftMin / MIN_PER_YEAR); leftMin -= year * MIN_PER_YEAR;
    const month = Math.floor(leftMin / MIN_PER_MONTH); leftMin -= month * MIN_PER_MONTH;
    const day = Math.floor(leftMin / MIN_PER_DAY); leftMin -= day * MIN_PER_DAY;
    const hour = Math.floor(leftMin / MIN_PER_HOUR); leftMin -= hour * MIN_PER_HOUR;
    const min = leftMin;

    const parts: string[] = [];
    if (year) parts.push(`${year}y`);
    if (month) parts.push(`${month}mo`);
    if (day) parts.push(`${day}d`);
    if (hour) parts.push(`${hour}h`);
    if (min || parts.length === 0) parts.push(`${min}m`);
    return `cycle duration ${parts.join(' ')}`;
}

function uniqueTags(tags: Array<string | null | undefined>): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of tags) {
        if (typeof raw !== 'string') continue;
        const tag = raw.trim();
        if (!tag) continue;
        if (seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
    }
    return out;
}

function bindSpokeTags(code: SpokeKey, index: number, durationTag: string): string[] {
    const isExtremum = code === 'N' || code === 'S';
    const isAxisMidpoint = code === 'E' || code === 'W';
    const codeTag = code === 'E_next' ? null : `${code}-bind`;
    return uniqueTags([
        codeTag,
        !isExtremum && (index <= 4 || index >= 13) ? 'distance rising' : null,
        !isExtremum && (index >= 5 && index <= 12) ? 'distance falling' : null,
        isAxisMidpoint ? 'mid distance' : null,
        code === 'N' ? 'max distance' : null,
        code === 'S' ? 'min distance' : null,
        code === 'E' ? 'cycle start' : null,
        code === 'E' ? durationTag : null,
    ]);
}

// --- Position / distance providers ---

function distanceAu_SunFocus(target: ObjId, ts: number): number {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));
    const body = toEngineBody(target);

    if (target === 'Sun') return 0;

    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(body, t);
            return vectorLengthSafe(v);
        }
    } catch {}

    try {
        if (typeof A.HelioDistance === 'function') {
            const r = A.HelioDistance(body, t);
            return isFiniteNumber(r) ? r : NaN;
        }
    } catch {}

    return NaN;
}

function distanceAu_EarthFocus(target: ObjId, ts: number): number {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));
    const body = toEngineBody(target);

    if (target === 'Earth') return 0;

    try {
        if (typeof A.GeoVector === 'function') {
            const v = A.GeoVector(body, t, false);
            return vectorLengthSafe(v);
        }
    } catch {}

    try {
        if (typeof A.GeoDistance === 'function') {
            const r = A.GeoDistance(body, t);
            return isFiniteNumber(r) ? r : NaN;
        }
    } catch {}

    return NaN;
}

// --- Monotonic root solve (bisection) on [t0,t1] for r(t)=targetR ---

type SolveOpts = {
    maxIters?: number;
    epsMs?: number;
    monoEps?: number;
    dbg?: { log?: (...a: any[]) => void; warn?: (...a: any[]) => void };
};

function solveTimeForDistance(
    rAt: (t: number) => number,
    t0: number,
    t1: number,
    targetR: number,
    increasing: boolean,
    opts: SolveOpts,
): number | null {
    const dbg = opts.dbg;
    const maxIters = opts.maxIters ?? 80;
    const epsMs = opts.epsMs ?? 200;
    const monoEps = opts.monoEps ?? 1e-12;

    let a = Math.min(t0, t1);
    let b = Math.max(t0, t1);

    let ra = rAt(a);
    let rb = rAt(b);

    if (!isFiniteNumber(ra) || !isFiniteNumber(rb)) {
        dbg?.warn?.('solveTimeForDistance: NaN endpoints', { a: fmt(a), b: fmt(b), ra, rb });
        return null;
    }

    if (increasing) {
        if (!((ra - monoEps) <= targetR && targetR <= (rb + monoEps))) {
            dbg?.warn?.('solveTimeForDistance: not bracketed (inc)', { a: fmt(a), b: fmt(b), ra, rb, targetR });
            return null;
        }
    } else {
        if (!((rb - monoEps) <= targetR && targetR <= (ra + monoEps))) {
            dbg?.warn?.('solveTimeForDistance: not bracketed (dec)', { a: fmt(a), b: fmt(b), ra, rb, targetR });
            return null;
        }
    }

    if (Math.abs(ra - targetR) <= monoEps * 10) return a;
    if (Math.abs(rb - targetR) <= monoEps * 10) return b;

    for (let i = 0; i < maxIters; i++) {
        const mid = (a + b) / 2;
        const rm = rAt(mid);
        if (!isFiniteNumber(rm)) return null;

        if (Math.abs(b - a) <= epsMs) return mid;

        if (increasing) {
            if (rm < targetR) {
                a = mid;
                ra = rm;
            } else {
                b = mid;
                rb = rm;
            }
        } else {
            if (rm > targetR) {
                a = mid;
                ra = rm;
            } else {
                b = mid;
                rb = rm;
            }
        }
    }

    return (a + b) / 2;
}

// --- Main wheel solver ---

export function solveBindWheel(input: WheelInput<'bind'>): CycleSolveResult<BindMeta> {
    const dbg = input.dbg;

    const fail = (reason: string): CycleSolveResult<BindMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    if (!input.focus) return fail('Bind wheel requires focus');
    if (!input.target) return fail('Bind wheel requires target');

    const focus: ObjId = input.focus;
    const target: ObjId = Array.isArray(input.target) ? input.target[0] : input.target;
    if (!target) return fail('Bind wheel requires valid target');

    const ts = input.ts;

    if (focus !== 'Sun' && focus !== 'Earth') {
        return fail(`Bind wheel: unsupported focus=${String(focus)} (supported: Sun|Earth)`);
    }
    if (focus === target) {
        return fail(`Bind wheel: focus and target must differ (got ${String(focus)})`);
    }

    const distanceAtAu = (t: number) =>
        focus === 'Sun' ? distanceAu_SunFocus(target, t) : distanceAu_EarthFocus(target, t);

    const r0 = distanceAtAu(ts);
    if (!isFiniteNumber(r0)) {
        return fail(`Bind wheel: cannot compute distance for focus=${String(focus)} target=${String(target)}`);
    }

    // -------- meta: ONLY cycleDuration --------
    const metaAny = (input.meta ?? {}) as any;
    const cycleDuration = Number(metaAny.cycleDuration);

    const cycleOverlap = 0.1;                  // 10% overlap
    const thirdStep = cycleDuration / 3;
    const halfWindow = thirdStep * (0.5 + cycleOverlap);

    if (!isFiniteNumber(cycleDuration) || cycleDuration <= 0) {
        return fail('Bind wheel: meta.cycleDuration (ms) is required and must be > 0');
    }

    // Search sampling step (coarse scan) derived from cycleDuration.
    // Clamp to avoid silly micro-steps for long cycles and avoid too coarse for short cycles.
    // const stepMs = clamp(cycleDuration / 240, 30 * 60_000, 90 * DAY_MS); // ~0.4% of cycle
    // const refineIters = 30;

    dbg?.log?.('bind.wheel.params', { cycleDuration, thirdWindow: thirdStep, halfWindow });

    const SOLVE: SolveOpts = {
        maxIters: 90,
        epsMs: clamp(cycleDuration / 2_000, 50, 5_000),
        monoEps: 1e-12,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    function solveOn(t0: number, t1: number, increasing: boolean, targetR: number): number {
        const solved = solveTimeForDistance(distanceAtAu, t0, t1, targetR, increasing, SOLVE);
        if (isFiniteNumber(solved)) return solved;
        return (t0 + t1) / 2;
    }

    let cycleDurationTag = '';

    function mkSpoke(i: number, tSolved: number, rAu: number): CycleSpoke<BindMeta> {
        const code = SPOKES_ORDER[i] ?? (i === 16 ? 'E_next' : 'E');
        return {
            ts: tSolved,
            code,
            index: i,
            tags: bindSpokeTags(code, i, cycleDurationTag),
            meta: { distanceAu: rAu, distanceKm: rAu * AU_KM },
        };
    }

    function findExtremum(c: number): Ext | null {
        return findExtremumInWindowGold(distanceAtAu, c, halfWindow, { dbg });
        // return findExtremumInWindow(distanceAtAu, c, halfWindow, {
        //     stepMs: Math.max(60_000, cycleDuration / 10000),
        //     refineIters: 100,
        //     dbg,
        // });
    }

    // Find bracketing (“обнимашки”): one extremum before ts, one after ts, and they must be opposite kinds.
    function findHugs(): { before: Ext; after: Ext } | null {
        dbg?.log?.('bind.hug.start', { ts: fmt(ts) });

        const centers = [ts - thirdStep, ts, ts + thirdStep];
        const found: Ext[] = [];

        function pushUniqueExt(e: Ext | null) {
            if (!e) return;
            if (!isFiniteNumber(e.t) || !isFiniteNumber(e.v)) return;
            if (found.some(x => Math.abs(x.t - e.t) < 1)) return; // ~1ms tolerance
            found.push(e);
        }

        // --- main 3 windows ---
        for (const c of centers) pushUniqueExt(findExtremum(c));

        // helper: choose best before/after from current set
        function pickBeforeAfter(): { before: Ext | null; after: Ext | null } {
            if (found.length === 0) return { before: null, after: null };

            found.sort((a, b) => a.t - b.t);

            let before: Ext | null = null;
            let after: Ext | null = null;

            for (const e of found) {
                if (e.t <= ts) {
                    if (!before || e.t > before.t) before = e;
                } else {
                    if (!after || e.t < after.t) after = e;
                }
            }
            return { before, after };
        }

        let { before, after } = pickBeforeAfter();

        // --- fallback: if not properly bracketed, try half-period shifts ---
        if (!before || !after) {
            dbg?.warn?.('bind.hug.fallback.halfPeriod', {
                reason: !before && !after ? 'no extrema' : (!before ? 'missing before' : 'missing after'),
                found: found.map(e => fmt(e.t)),
            });

            // pick a reference extremum to generate the opposite-side candidate
            // prefer the closest known extremum to ts (if any)
            let ref: Ext | null = null;
            if (found.length > 0) {
                ref = found.reduce((best, e) => {
                    const db = Math.abs(best.t - ts);
                    const de = Math.abs(e.t - ts);
                    return de < db ? e : best;
                }, found[0]);
            }

            // If nothing found at all, do one more attempt: centered exactly at ts but wider.
            // (rare; helps if an extremum sat right on the border and got rejected)
            if (!ref) {
                pushUniqueExt(findExtremum(ts)); // same window params
                ({ before, after } = pickBeforeAfter());
                ref = found.length ? found.reduce((best, e) => (Math.abs(e.t - ts) < Math.abs(best.t - ts) ? e : best), found[0]) : null;
            }

            if (ref) {
                // try both sides at half period
                const halfPeriod = cycleDuration / 2;

                // We *do not* know which side we need, so just try both, then pick bracket.
                pushUniqueExt(findExtremum(ref.t - halfPeriod));
                pushUniqueExt(findExtremum(ref.t + halfPeriod));

                // Re-pick after adding candidates
                ({ before, after } = pickBeforeAfter());
            }
        }

        // Still not bracketed? Last-ditch: try moving the missing side by one full thirdStep
        // (kept minimal; you can remove if you want “pure halfPeriod only”)
        if (!before || !after) {
            dbg?.warn?.('bind.hug.fallback.last', {
                reason: !before && !after ? 'no extrema even after halfPeriod' : (!before ? 'still missing before' : 'still missing after'),
                found: found.map(e => fmt(e.t)),
            });

            if (!before) pushUniqueExt(findExtremum(ts - 2 * thirdStep));
            if (!after)  pushUniqueExt(findExtremum(ts + 2 * thirdStep));

            ({ before, after } = pickBeforeAfter());
        }

        if (!before || !after) {
            dbg?.warn?.('bind.hug.fail', {
                ts: fmt(ts),
                found: found.map(e => ({ t: fmt(e.t), v: e.v })),
                thirdStepDays: (thirdStep / DAY_MS).toFixed(4),
                halfWindowDays: (halfWindow / DAY_MS).toFixed(4),
            });
            return null;
        }

        dbg?.log?.('bind.hug.success', {
            ts: fmt(ts),
            before: { t: fmt(before.t), v: before.v },
            after: { t: fmt(after.t), v: after.v },
        });

        return { before, after };
    }

    function solveMidOnArc(a: Ext, b: Ext): { tMid: number; rMid: number; increasing: boolean } | null {
        if (!isFiniteNumber(a.v) || !isFiniteNumber(b.v)) return null;
        if (!(a.t < b.t)) return null;

        const increasing = b.v > a.v;
        const rMid = (a.v + b.v) / 2;
        const tMid = solveOn(a.t, b.t, increasing, rMid);
        if (!isFiniteNumber(tMid)) return null;
        return { tMid, rMid, increasing };
    }

    // ------------------------------------------------------------
    // 1) Find “обнимашки” around ts
    // ------------------------------------------------------------
    const hugs = findHugs();
    if (!hugs) return fail('Bind wheel: failed to locate hugging extrema around ts');

    let A = hugs.before; // closest extremum at/before ts
    let B = hugs.after;  // closest extremum after ts

    if (!(A.t < B.t)) return fail('Bind wheel: invalid hugging extrema ordering');
    if (!isFiniteNumber(A.v) || !isFiniteNumber(B.v)) return fail('Bind wheel: invalid hugging extrema values');

    dbg?.log?.('bind.hug', {
        focus, target,
        ts: fmt(ts),
        A: { t: fmt(A.t), v: A.v },
        B: { t: fmt(B.t), v: B.v },
        cycleDays: (cycleDuration / DAY_MS).toFixed(2),
        thirdDays: (thirdStep / DAY_MS).toFixed(2),
        // stepHours: (stepMs / 3_600_000).toFixed(2),
    });

    // ------------------------------------------------------------
    // 2) Resolve the “cell”: E boundary and which cycle ts belongs to
    //     then resolve S_before, N, S, N_next and boundaries E, E_next.
    // ------------------------------------------------------------

    let S_before: Ext;
    let N: Ext;
    let S: Ext;
    let N_next: Ext;

    let E_t: number;
    let E_next_t: number;

    const increasingArc = A.v < B.v;

    dbg?.log?.('bind.hugs.result', { A, B, ts, increasingArc });

    if (increasingArc) {
        // Then A is min-side and B is max-side (but could be S_before->N OR S->N_next).
        const mid = solveMidOnArc(A, B);
        if (!mid || !mid.increasing) return fail('Bind wheel: failed to solve mid on increasing arc');
        const E_mid = mid.tMid;

        if (ts < E_mid) {
            S = A;
            N_next = B;
            E_next_t = E_mid;
            // resolve N and S_before backwards
            const N0 = findExtremum(S.t - cycleDuration / 2);
            if (!N0) return fail('Bind wheel: failed to locate N (prev max before S)');
            N = N0;
            if (N.v < S.v) return fail('Bind wheel: invalid N value (increasing arc)' );


            const Sb0 = findExtremum(N.t - cycleDuration / 2);
            if (!Sb0) return fail('Bind wheel: failed to locate S_before (prev min before N)');
            S_before = Sb0;
            if (S_before.v > N.v) return fail('Bind wheel: invalid S_before value (increasing arc)' );

            const midE = solveMidOnArc(S_before, N);
            if (!midE || !midE.increasing) return fail('Bind wheel: failed to solve E on S_before->N');
            E_t = midE.tMid;
        } else {
            // ts is already in head of next cycle on arc E .. N (same min->max arc),
            // so A=min is S_before, B=max is N, and E = E_mid.
            S_before = A;
            N = B;
            E_t = E_mid;

            // resolve S and N_next forwards
            const S0 = findExtremum(N.t + cycleDuration / 2);
            if (!S0) return fail('Bind wheel: failed to locate S (next min after N)');
            S = S0;
            if (S.v > N.v) return fail('Bind wheel: invalid S value (increasing arc)' );

            const Nn0 = findExtremum(S.t + cycleDuration / 2);
            if (!Nn0) return fail('Bind wheel: failed to locate N_next (next max after S)');
            N_next = Nn0;
            if (N_next.v < S.v) return fail('Bind wheel: invalid N_next value (increasing arc)' );

            const midE2 = solveMidOnArc(S, N_next);
            if (!midE2 || !midE2.increasing) return fail('Bind wheel: failed to solve E_next on S->N_next');
            E_next_t = midE2.tMid;
        }
    } else {
        // Case B: hugging extrema are max->min (decreasing arc), i.e. ts is between N and S.
        // Here A=max is N, B=min is S.
        N = A;
        S = B;

        const Sb0 = findExtremum(N.t - cycleDuration / 2);
        if (!Sb0) return fail('Bind wheel: failed to locate S_before (prev min before N)');
        S_before = Sb0;
        if (S_before.v > N.v) {
            dbg?.warn?.('Bind wheel: invalid S_before value (decreasing arc)', {S_before, N, S, ts} );
            return fail('Bind wheel: invalid S_before value (decreasing arc)' );
        }

        const Nn0 = findExtremum(S.t + cycleDuration / 2);
        if (!Nn0) return fail('Bind wheel: failed to locate N_next (next max after S)');
        N_next = Nn0;
        if (N_next.v < S.v) return fail('Bind wheel: invalid N_next value (decreasing arc)' );

        const midE = solveMidOnArc(S_before, N);
        if (!midE || !midE.increasing) return fail('Bind wheel: failed to solve E on S_before->N');
        E_t = midE.tMid;

        const midE2 = solveMidOnArc(S, N_next);
        if (!midE2 || !midE2.increasing) return fail('Bind wheel: failed to solve E_next on S->N_next');
        E_next_t = midE2.tMid;
    }

    // ------------------------------------------------------------
    // 3) Sanity checks (warn-only)
    // ------------------------------------------------------------
    if (!(S_before.t < N.t && N.t < S.t && S.t < N_next.t)) {
        dbg?.warn?.('bind.window: suspicious extrema ordering', {
            S_before: fmt(S_before.t),
            N: fmt(N.t),
            S: fmt(S.t),
            N_next: fmt(N_next.t),
            E: fmt(E_t),
            E_next: fmt(E_next_t),
        });
    }

    const spanE = E_next_t - E_t;
    if (!(spanE > 0)) {
        dbg?.warn?.('bind.window: non-positive E..E_next span', { E: fmt(E_t), E_next: fmt(E_next_t) });
    } else {
        const maxReasonable = cycleDuration * (1 + 3 * cycleOverlap);
        const minReasonable = cycleDuration * (1 - 3 * cycleOverlap);
        if (spanE < minReasonable || spanE > maxReasonable) {
            dbg?.warn?.('bind.window: span differs from cycleDuration', {
                spanDays: (spanE / DAY_MS).toFixed(4),
                cycleDays: (cycleDuration / DAY_MS).toFixed(4),
                E: fmt(E_t),
                E_next: fmt(E_next_t),
            });
        }
    }

    dbg?.log?.('bind.window', {
        focus,
        target,
        ts: fmt(ts),
        cycleDays: (cycleDuration / DAY_MS).toFixed(4),
        // stepHours: (stepMs / 3_600_000).toFixed(2),
        thirdDays: (thirdStep / DAY_MS).toFixed(2),
        halfDays: (halfWindow / DAY_MS).toFixed(2),
        hugs: {
            A: { t: fmt(A.t), v: A.v },
            B: { t: fmt(B.t), v: B.v },
        },
        S_before: { t: fmt(S_before.t), rAu: S_before.v },
        N: { t: fmt(N.t), rAu: N.v },
        S: { t: fmt(S.t), rAu: S.v },
        N_next: { t: fmt(N_next.t), rAu: N_next.v },
        E: fmt(E_t),
        E_next: fmt(E_next_t),
    });
    // ------------------------------------------------------------
    // 4) Build 17 spokes using explicit E and E_next
    // ------------------------------------------------------------

    const spokes: CycleSpoke<BindMeta>[] = [];

    // Definitions by construction:
    // E is mid-distance on arc S_before->N
    // E_next is mid-distance on arc S->N_next
    const rE = (S_before.v + N.v) / 2;
    const rN = N.v;
    const rS = S.v;
    const rE2 = (S.v + N_next.v) / 2;
    cycleDurationTag = formatCycleDurationTag(E_next_t - E_t);

    function solveOnInc(t0: number, t1: number, r: number) {
        return solveOn(t0, t1, true, r);
    }
    function solveOnDec(t0: number, t1: number, r: number) {
        return solveOn(t0, t1, false, r);
    }

    // 0..4 : E -> N (increasing, inside S_before..N, anchored at E and N)
    for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        const targetR = lerp(rE, rN, u);

        let tSolved: number;
        if (i === 0) tSolved = E_t;
        else if (i === 4) tSolved = N.t;
        else tSolved = solveOnInc(S_before.t, N.t, targetR);

        const rAu = distanceAtAu(tSolved);
        spokes.push(mkSpoke(i, tSolved, isFiniteNumber(rAu) ? rAu : targetR));
    }

    // 5..12 : N -> S (decreasing, inside N..S, anchored at S)
    for (let i = 5; i <= 12; i++) {
        const u = (i - 4) / 8; // 5..12 => 1..8 / 8
        const targetR = lerp(rN, rS, u);

        let tSolved: number;
        if (i === 12) tSolved = S.t;
        else tSolved = solveOnDec(N.t, S.t, targetR);

        const rAu = distanceAtAu(tSolved);
        spokes.push(mkSpoke(i, tSolved, isFiniteNumber(rAu) ? rAu : targetR));
    }

    // 13..16 : S -> E_next (increasing, inside S..N_next, anchored at E_next)
    for (let i = 13; i <= 16; i++) {
        const u = (i - 12) / 4; // 13..16 => 1..4 / 4
        const targetR = lerp(rS, rE2, u);

        let tSolved: number;
        if (i === 16) tSolved = E_next_t;
        else tSolved = solveOnInc(S.t, N_next.t, targetR);

        const rAu = distanceAtAu(tSolved);
        spokes.push(mkSpoke(i, tSolved, isFiniteNumber(rAu) ? rAu : targetR));
    }

    // Monotonic check (warn-only)
    for (let i = 1; i < spokes.length; i++) {
        if (!(spokes[i].ts >= spokes[i - 1].ts)) {
            dbg?.warn?.('bind: non-monotonic spoke times', {
                i,
                prev: { i: i - 1, ts: fmt(spokes[i - 1].ts), code: spokes[i - 1].code },
                cur: { i, ts: fmt(spokes[i].ts), code: spokes[i].code },
                E: fmt(E_t),
                E_next: fmt(E_next_t),
            });
            break;
        }
    }

    // Final sanity: spoke[0] and spoke[16] should match E and E_next
    if (spokes[0] && !nearEq(spokes[0].ts, E_t, 5_000, 0)) {
        dbg?.warn?.('bind: spoke[0] not at E', { spoke0: fmt(spokes[0].ts), E: fmt(E_t) });
    }
    if (spokes[16] && !nearEq(spokes[16].ts, E_next_t, 5_000, 0)) {
        dbg?.warn?.('bind: spoke[16] not at E_next', { spoke16: fmt(spokes[16].ts), E_next: fmt(E_next_t) });
    }

    dbg?.log?.('bind.done', { ts: fmt(ts), E: fmt(E_t), E_next: fmt(E_next_t), spokesCount: spokes.length });

    return { ok: true, kind: 'cycle', ts, spokes };
}
