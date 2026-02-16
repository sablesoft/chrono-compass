// src/lib/math/bind.ts
//
// Unified Bind wheel solver (distance-linear) for focus ∈ {Sun, Earth}.
// - Uses a generic extrema finder (no target-specific switches).
// - Builds a cycle window around input.ts using the “boundary probe” algorithm.
//
// Distances are computed in AU (meta.distanceAu) and also km (meta.distanceKm) for convenience.

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { BodyId, BindWheelMeta } from '../catalog';
import { SPOKES_ORDER } from '../wheel/spokes';

import { findExtremumInDirection, type FindExtremaOpts } from './extrema';
import { vectorLengthSafe } from './vector';
import {DAY_MS, isFiniteNumber} from './helpers';

const AU_KM = 149_597_870.7;

// A hard guard so we don't accidentally build "cycles" lasting months for fast systems.
// For Earth–Moon, anything > ~60 days is almost certainly a wrong extremum pick.
const DEFAULT_MAX_CYCLE_SPAN_MS = 120 * DAY_MS;

export type BindMeta = {
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

// --- Position / distance providers ---

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
            if (rm < targetR) { a = mid; ra = rm; }
            else { b = mid; rb = rm; }
        } else {
            if (rm > targetR) { a = mid; ra = rm; }
            else { b = mid; rb = rm; }
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

    // ---- Meta overrides (per role-combo) ----
    const meta = (input.meta ?? {}) as BindWheelMeta;

    const extremaMeta = meta.extrema ?? {};
    const solveMeta = meta.solve ?? {};
    const sanityMeta = meta.sanity ?? {};

    const extremaOpts: FindExtremaOpts = {
        windowMs: extremaMeta.windowMs ?? 180 * DAY_MS,
        stepMs: extremaMeta.stepMs ?? 12 * 3_600_000,
        maxWindowMs: extremaMeta.maxWindowMs ?? 6000 * DAY_MS,
        refineIters: extremaMeta.refineIters ?? 30,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    const SOLVE: SolveOpts = {
        maxIters: solveMeta.maxIters ?? 70,
        epsMs: solveMeta.epsMs ?? 500,
        monoEps: solveMeta.monoEps ?? 1e-12,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    // sanity defaults
    const defaultMaxCycleMs =
        focus === 'Earth' && target === 'Moon'
            ? 60 * DAY_MS
            : DEFAULT_MAX_CYCLE_SPAN_MS;

    const maxCycleMs = sanityMeta.maxCycleMs ?? defaultMaxCycleMs;
    const maxProbeLagMs = sanityMeta.maxProbeLagMs ?? maxCycleMs;

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
            },
        };
    }

    function classifyExtremum(
        f: (t:number)=>number,
        e: Ext,
        stepMs: number
    ): 'max'|'min'|'flat' {
        const dt = Math.max(stepMs * 2, 10 * DAY_MS);
        const v0 = e.v;
        const vL = f(e.t - dt);
        const vR = f(e.t + dt);
        if (!isFiniteNumber(vL) || !isFiniteNumber(vR) || !isFiniteNumber(v0)) return 'flat';

        // tolerance: для AU разницы могут быть очень маленькие на дальних планетах
        const eps = Math.max(1e-10, Math.abs(v0) * 1e-10);

        const leftHigher  = vL > v0 + eps;
        const rightHigher = vR > v0 + eps;
        const leftLower   = vL < v0 - eps;
        const rightLower  = vR < v0 - eps;

        if (leftHigher && rightHigher) return 'min';
        if (leftLower && rightLower) return 'max';
        return 'flat';
    }

    // ------------------------------------------------------------
    // Boundary-probe algorithm
    // ------------------------------------------------------------

    // A small helper to avoid "jumping seasons" for fast systems:
    // if the found extremum is absurdly far, retry with a tighter window centered closer.
    function guardedExtremum(
        tStart: number,
        kind: 'max' | 'min',
        dir: 1 | -1,
        label: string,
    ): Ext | null {
        const e0 = findExtremumInDirection(distanceAtAu, tStart, kind, dir, extremaOpts) as Ext | null;
        if (!e0) return null;

        const stepForNudge = Math.max(extremaOpts.stepMs ?? 12 * 3_600_000, 30 * DAY_MS);
        const nudge = Math.min(stepForNudge, 365 * DAY_MS); // чтобы не улететь на полвека

        const actual = classifyExtremum(distanceAtAu, e0, extremaOpts.stepMs ?? 12 * 3_600_000);

        if (actual !== 'flat' && actual !== kind) {
            dbg?.warn?.('bind: extremum kind mismatch, hopping to find wanted kind', {
                label, want: kind, got: actual, at: fmt(e0.t), v: e0.v,
            });

            // ВАЖНО: ищем нужный kind уже "за" найденным экстремумом
            const hopStart = e0.t + dir * nudge;
            const eHop = findExtremumInDirection(distanceAtAu, hopStart, kind, dir, extremaOpts) as Ext | null;
            if (eHop) return eHop;
            // fallback: оставляем e0
        }

        // (B) твой guard по дальности — ОК, но должен учитывать ПОСЛЕ switch тоже,
        // поэтому dt считаем по e0 (или по выбранному eSwap если ты вернул его выше)
        const dt = Math.abs(e0.t - tStart);
        if (dt <= maxProbeLagMs) return e0;

        dbg?.warn?.('bind: extremum too far, retry tighter', {
            label, kind, dir,
            tStart: fmt(tStart),
            got: fmt(e0.t),
            dtDays: (dt / DAY_MS).toFixed(1),
            maxDays: (maxProbeLagMs / DAY_MS).toFixed(1),
            meta,
        });

        const tighter: FindExtremaOpts = {
            ...extremaOpts,
            windowMs: Math.min(extremaOpts.windowMs ?? 180 * DAY_MS, maxProbeLagMs),
            maxWindowMs: Math.min(
                extremaOpts.maxWindowMs ?? 6000 * DAY_MS,
                Math.max(maxProbeLagMs * 2, (extremaOpts.windowMs ?? 0))
            ),
        };

        const e1 = findExtremumInDirection(distanceAtAu, tStart, kind, dir, tighter) as Ext | null;
        if (!e1) return e0;

        const dt1 = Math.abs(e1.t - tStart);
        return dt1 <= dt ? e1 : e0;
    }

    // 1) NProbe = ближайший MAX после ts
    const NProbe = guardedExtremum(ts, 'max', 1, 'NProbe') as Ext | null;
    if (!NProbe) return fail('Bind wheel: failed to locate NProbe (next max)');

    // 2) SProbe = ближайший MIN перед NProbe
    const SProbe = guardedExtremum(NProbe.t, 'min', -1, 'SProbe') as Ext | null;
    if (!SProbe) return fail('Bind wheel: failed to locate SProbe (prev min)');

    if (!isFiniteNumber(NProbe.v) || !isFiniteNumber(SProbe.v) || !(NProbe.v > SProbe.v)) {
        dbg?.warn?.('bind.probe.values', {
            focus, target,
            NProbe: { t: fmt(NProbe.t), v: NProbe.v },
            SProbe: { t: fmt(SProbe.t), v: SProbe.v },
            stepMs: extremaOpts.stepMs,
            windowMs: extremaOpts.windowMs,
        });
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

    let boundaryIsE = false;

    if (ts < boundary) {
        // boundary is E_next (end of current cycle)
        S = SProbe;
        N_next = NProbe;

        const NPrev = guardedExtremum(S.t, 'max', -1, 'N(prev max)') as Ext | null;
        if (!NPrev) return fail('Bind wheel: failed to locate N (prev max)');
        N = NPrev;

        const SPrev = guardedExtremum(N.t, 'min', -1, 'S_before(prev min)') as Ext | null;
        if (!SPrev) return fail('Bind wheel: failed to locate S_before (prev min)');
        S_before = SPrev;

        boundaryIsE = false;
    } else {
        // boundary is E
        N = NProbe;
        S_before = SProbe;

        const SNext = guardedExtremum(N.t, 'min', 1, 'S(next min)') as Ext | null;
        if (!SNext) return fail('Bind wheel: failed to locate S (next min)');
        S = SNext;

        const NNext = guardedExtremum(S.t, 'max', 1, 'N_next(next max)') as Ext | null;
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

    // Additional sanity: cycle span must be plausible (especially for Earth–Moon)
    const span = Math.abs(N_next.t - S_before.t);
    if (span > maxCycleMs * 2) {
        dbg?.warn?.('bind: suspicious huge window span', {
            spanDays: (span / DAY_MS).toFixed(1),
            maxDays: (maxCycleMs / DAY_MS).toFixed(1),
            S_before: fmt(S_before.t),
            N_next: fmt(N_next.t),
            focus, target,
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
        meta,
        extremaOpts,
        SOLVE,
    });

    // ------------------------------------------------------------
    // Build 17 spokes (0..16)
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

    // Final sanity: E..E_next span should not be ridiculous

    const E = spokes[0]?.ts;
    const E2 = spokes[16]?.ts;
    if (isFiniteNumber(E) && isFiniteNumber(E2)) {
        const spanE = E2 - E;
        if (spanE <= 0 || spanE > maxCycleMs) {
            dbg?.warn?.('bind: suspicious E..E_next span', {
                E: fmt(E),
                E_next: fmt(E2),
                spanDays: (spanE / DAY_MS).toFixed(2),
                maxDays: (maxCycleMs / DAY_MS).toFixed(2),
                focus, target,
            });
        }
    }

    dbg?.log?.('bind.done', { ts: fmt(ts), boundary: fmt(boundary), boundaryIsE, spokes });

    return { ok: true, kind: 'cycle', ts, spokes };
}
