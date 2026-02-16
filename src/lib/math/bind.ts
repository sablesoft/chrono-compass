// src/lib/math/bind.ts
//
// Unified Bind wheel solver (distance-linear) for focus ∈ {Sun, Earth}.
// - Uses a generic extrema finder (no target-specific switches).
// - Builds a cycle window around input.ts using the “boundary probe” algorithm:
//   1) NProbe = ближайший MAX после ts
//   2) SProbe = ближайший MIN перед NProbe
//   3) boundary = момент mid-distance на дуге SProbe -> NProbe (increasing)
//   4) if ts < boundary: boundary is E_next (end of current cycle) => S=SProbe, N_next=NProbe, then find N (prev max before S) and S_before (prev min before N)
//      else: boundary is E (start of current cycle) => N=NProbe, S_before=SProbe, then find S (next min after N) and N_next (next max after S)
//   5) Build 17 spokes (0..16): E..E_next with anchors:
//      0(E), 4(N), 8(W), 12(S), 16(E_next)
//
// Distances are computed in AU (meta.distanceAu) and also km (meta.distanceKm) for convenience.

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { BodyId } from '../catalog';
import { SPOKES_ORDER } from '../wheel/spokes';

import { findExtremumInDirection, type FindExtremaOpts } from './extrema';
import { vectorLengthSafe } from './vector';
import { isFiniteNumber } from './helpers';

const DAY_MS = 86_400_000;
const AU_KM = 149_597_870.7;

export type BindMeta = {
    // distance focus-target at this spoke
    distanceAu: number;
    distanceKm: number;
};

type Ext = { t: number; v: number };

function toEngineBody(id: BodyId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

// --- Position / distance providers (the only "branch" we allow, by focus model) ---

function distanceAu_SunFocus(target: BodyId, ts: number): number {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));
    const body = toEngineBody(target);

    // Sun is origin in heliocentric coords
    if (target === 'Sun') return 0;

    // Best: HelioVector(body, time)
    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(body, t);
            return vectorLengthSafe(v);
        }
    } catch {}

    // Alt: HelioDistance(body, time)
    try {
        if (typeof A.HelioDistance === 'function') {
            const r = A.HelioDistance(body, t);
            return isFiniteNumber(r) ? r : NaN;
        }
    } catch {}

    return NaN;
}

function distanceAu_EarthFocus(target: BodyId, ts: number): number {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));
    const body = toEngineBody(target);

    if (target === 'Earth') return 0;

    // Best: GeoVector(body, time, aberration=false)
    try {
        if (typeof A.GeoVector === 'function') {
            const v = A.GeoVector(body, t, false);
            return vectorLengthSafe(v);
        }
    } catch {}

    // Some builds may expose GeoDistance(body, time)
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
    // tiny slack so we don't fail on floating noise
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
    const maxIters = opts.maxIters ?? 70;
    const epsMs = opts.epsMs ?? 500;
    const monoEps = opts.monoEps ?? 1e-12;

    let a = Math.min(t0, t1);
    let b = Math.max(t0, t1);

    let ra = rAt(a);
    let rb = rAt(b);

    if (!isFiniteNumber(ra) || !isFiniteNumber(rb)) {
        dbg?.warn?.('solveTimeForDistance: NaN endpoints', { a: fmt(a), b: fmt(b), ra, rb });
        return null;
    }

    // Ensure [a,b] brackets target, allowing tiny noise
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

    // If target near endpoint, return endpoint quickly
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

export function solveBindWheel(input: WheelInput): CycleSolveResult<BindMeta> {
    const dbg = input.dbg;

    const fail = (reason: string): CycleSolveResult<BindMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    // Hard role validation
    if (!input.focus) return fail('Bind wheel requires focus');
    if (!input.target) return fail('Bind wheel requires target');

    const focus: BodyId = input.focus;
    const target: BodyId = Array.isArray(input.target) ? input.target[0] : input.target;

    if (!target) return fail('Bind wheel requires valid target');

    const ts = input.ts;

    // Current scope: only focus Sun/Earth
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

    const extremaOpts: FindExtremaOpts = {
        windowMs: 180 * DAY_MS,
        stepMs: 12 * 3_600_000, // 12h
        maxWindowMs: 6000 * DAY_MS,
        refineIters: 30,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    const SOLVE: SolveOpts = {
        maxIters: 70,
        epsMs: 500,
        monoEps: 1e-12,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    function solveOn(t0: number, t1: number, increasing: boolean, targetR: number): number {
        const solved = solveTimeForDistance(distanceAtAu, t0, t1, targetR, increasing, SOLVE);
        if (isFiniteNumber(solved)) return solved;
        return (t0 + t1) / 2;
    }

    function rLerp(a: number, b: number, t01: number) {
        return a + (b - a) * t01;
    }

    function mkSpoke(i: number, tSolved: number, rAu: number): CycleSpoke<BindMeta> {
        return {
            ts: tSolved,
            code: SPOKES_ORDER[i] ?? 'E',
            index: i,
            meta: {
                distanceAu: rAu,
                distanceKm: rAu * AU_KM,
            } satisfies BindMeta,
        };
    }

    // ------------------------------------------------------------
    // Boundary-probe algorithm (your steps)
    // ------------------------------------------------------------

    // 1) NProbe = ближайший MAX после ts
    const NProbe = findExtremumInDirection(distanceAtAu, ts, 'max', 1, extremaOpts) as Ext | null;
    if (!NProbe) return fail('Bind wheel: failed to locate NProbe (next max)');

    // 2) SProbe = ближайший MIN перед NProbe
    const SProbe = findExtremumInDirection(distanceAtAu, NProbe.t, 'min', -1, extremaOpts) as Ext | null;
    if (!SProbe) return fail('Bind wheel: failed to locate SProbe (prev min)');

    if (!isFiniteNumber(NProbe.v) || !isFiniteNumber(SProbe.v) || !(NProbe.v > SProbe.v)) {
        return fail('Bind wheel: invalid probe extrema distances');
    }

    // 3) boundary = mid-distance moment on SProbe -> NProbe (increasing)
    const rMidProbe = (SProbe.v + NProbe.v) / 2;
    const boundary = solveOn(SProbe.t, NProbe.t, true, rMidProbe);
    if (!isFiniteNumber(boundary)) return fail('Bind wheel: failed to locate boundary (E/E_next)');

    // 4-5) pick the correct cycle window
    let S_before: Ext;
    let N: Ext;
    let S: Ext;
    let N_next: Ext;

    let boundaryIsE = false; // else boundary is E_next

    if (ts < boundary) {
        // boundary is E_next (end of current cycle)
        S = SProbe;
        N_next = NProbe;

        const NPrev = findExtremumInDirection(distanceAtAu, S.t, 'max', -1, extremaOpts) as Ext | null;
        if (!NPrev) return fail('Bind wheel: failed to locate N (prev max)');
        N = NPrev;

        const SPrev = findExtremumInDirection(distanceAtAu, N.t, 'min', -1, extremaOpts) as Ext | null;
        if (!SPrev) return fail('Bind wheel: failed to locate S_before (prev min)');
        S_before = SPrev;

        boundaryIsE = false;
    } else {
        // boundary is E (start of current cycle)
        N = NProbe;
        S_before = SProbe;

        const SNext = findExtremumInDirection(distanceAtAu, N.t, 'min', 1, extremaOpts) as Ext | null;
        if (!SNext) return fail('Bind wheel: failed to locate S (next min)');
        S = SNext;

        const NNext = findExtremumInDirection(distanceAtAu, S.t, 'max', 1, extremaOpts) as Ext | null;
        if (!NNext) return fail('Bind wheel: failed to locate N_next (next max)');
        N_next = NNext;

        boundaryIsE = true;
    }

    // Sanity ordering (warn only)
    if (!(S_before.t < N.t && N.t < S.t && S.t < N_next.t)) {
        dbg?.warn?.('bind: suspicious extrema ordering', {
            S_before: fmt(S_before.t),
            N: fmt(N.t),
            S: fmt(S.t),
            N_next: fmt(N_next.t),
            boundary: fmt(boundary),
            boundaryIsE,
        });
    }

    const rMax = N.v;
    const rMin = S.v;
    const rMid = (rMin + rMax) / 2;

    if (!isFiniteNumber(rMax) || !isFiniteNumber(rMin) || !(rMax > rMin)) {
        return fail(`Bind wheel: invalid extrema distances (rMin=${rMin}, rMax=${rMax})`);
    }

    dbg?.log?.('bind.window', {
        focus,
        target,
        ts: fmt(ts),
        boundary: fmt(boundary),
        boundaryIsE,
        S_before: { t: fmt(S_before.t), rAu: S_before.v },
        N: { t: fmt(N.t), rAu: N.v },
        S: { t: fmt(S.t), rAu: S.v },
        N_next: { t: fmt(N_next.t), rAu: N_next.v },
        rMin,
        rMid,
        rMax,
    });

    // ------------------------------------------------------------
    // Build 17 spokes (0..16)
    //   0..4  : rMid -> rMax on [S_before..N] increasing
    //   4..8  : rMax -> rMid on [N..S]       decreasing
    //   8..12 : rMid -> rMin on [N..S]       decreasing
    //   12..16: rMin -> rMid on [S..N_next]  increasing
    //
    // Anchors: 0(E), 4(N), 8(W), 12(S), 16(E_next)
    // And we reuse the probed boundary as either E or E_next.
    // ------------------------------------------------------------

    const spokes: CycleSpoke<BindMeta>[] = [];

    for (let i = 0; i <= 16; i++) {
        let targetR: number;
        let tSolved: number;

        if (i <= 4) {
            // S_before -> N (increasing), rMid -> rMax
            const u = i / 4;
            targetR = rLerp(rMid, rMax, u);

            if (i === 4) {
                tSolved = N.t;
                targetR = rMax;
            } else if (i === 0 && boundaryIsE) {
                // boundary is E (start of cycle)
                tSolved = boundary;
                targetR = rMid;
            } else {
                tSolved = solveOn(S_before.t, N.t, true, targetR);
            }
        } else if (i <= 8) {
            // N -> S (decreasing), rMax -> rMid
            const u = (i - 4) / 4;
            targetR = rLerp(rMax, rMid, u);
            tSolved = solveOn(N.t, S.t, false, targetR);
        } else if (i <= 12) {
            // N -> S (decreasing), rMid -> rMin
            const u = (i - 8) / 4;
            targetR = rLerp(rMid, rMin, u);

            if (i === 12) {
                tSolved = S.t;
                targetR = rMin;
            } else {
                tSolved = solveOn(N.t, S.t, false, targetR);
            }
        } else {
            // S -> N_next (increasing), rMin -> rMid
            const u = (i - 12) / 4;
            targetR = rLerp(rMin, rMid, u);

            if (i === 16 && !boundaryIsE) {
                // boundary is E_next (end of cycle)
                tSolved = boundary;
                targetR = rMid;
            } else {
                tSolved = solveOn(S.t, N_next.t, true, targetR);
            }
        }

        // Meta uses actual computed distance at tSolved (so it reflects reality)
        const rAu = distanceAtAu(tSolved);
        spokes.push(mkSpoke(i, tSolved, isFiniteNumber(rAu) ? rAu : targetR));
    }

    // Monotonic check (warn only)
    for (let i = 1; i < spokes.length; i++) {
        if (!(spokes[i].ts >= spokes[i - 1].ts)) {
            dbg?.warn?.('bind: non-monotonic spoke times', {
                i,
                prev: { i: i - 1, ts: fmt(spokes[i - 1].ts), code: spokes[i - 1].code },
                cur: { i, ts: fmt(spokes[i].ts), code: spokes[i].code },
                boundary: fmt(boundary),
                boundaryIsE,
            });
            break;
        }
    }

    dbg?.log?.('bind.done', { ts: fmt(ts), boundary: fmt(boundary), boundaryIsE, spokes });

    return { ok: true, kind: 'cycle', ts, spokes };
}
