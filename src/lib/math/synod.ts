// src/lib/math/synod.ts
//
// Unified Synod wheel solver (phase-angular, 17 spokes) for any (looker, focus, target)
// where focus may be engine_body OR reference.
//
// v5.0 (DIRECTED-CROSSING BOUNDARIES + ANCHORED UNWRAP):
// - We do NOT “count turns” via unwrapStep during boundary search (this caused Venus double-cycle).
// - Instead we find E and E_next as the nearest θ=90° directed crossings around ts:
//
//   Let θ_mod(t) be the forward phase in [0..360) that always increases with time (mod 360):
//     θ_mod = φ            if motion=CCW
//     θ_mod = 360 - φ      if motion=CW
//
//   Define signed diff to 90° in [-180..180]:
//     g(t) = toSigned180(norm360(θ_mod(t) - 90))
//
//   For increasing θ_mod, the “correct” crossing is where g goes negative -> non-negative.
//   We scan in a window around ts, refine with bisection, then pick:
//     E      = last crossing at/before ts
//     E_next = first crossing after ts
//
// - After we have (E, E_next), we build an UNWRAPPED θ in [90..450) ANCHORED at E time:
//   this removes the 90/450 ambiguity cleanly.
// - Spokes are solved by bisection on θ_unwrap(t) - targetU inside [E..E_next].
// - All solving/validation uses exact timestamps. Only final spoke.ts is rounded to minutes
//   with monotonic enforcement.
//
// Notes:
// - Works for fast and slow bodies: window expansion handles long cycles,
//   adaptive step aims ~20° per step but is clamped to avoid absurd steps.

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { ObjId, ObjKind, ReferenceMeta } from '../catalog';
import { objects } from '../catalog';
import { SPOKES_ORDER } from '../wheel/types';

import { AU_KM, clamp, DAY_MS, isFiniteNumber, lerp, norm360, toSigned180 } from './helpers';
import { refUnit, lonDegEcliptic, type Vec } from './vector';
import { fmt } from './extrema';

export type SynodMeta = {
    phaseDeg: number; // raw φ in [0..360)
    phaseForwardDeg: number; // θ_mod target (static) in [0..360)
    phaseUnwrapDeg: number; // θ_unwrap target (static) in [90..450)
    motion: 'ccw' | 'cw';
    distanceAu: number;
    distanceKm: number;
    focusDistAu: number;
};

type SolveOpts = {
    maxIters?: number;
    epsMs?: number;
    dbg?: { log?: (...a: any[]) => void; warn?: (...a: any[]) => void };
};

type ObjRec = { id: ObjId; kind: ObjKind; meta?: any } | null;

function getObj(id: ObjId): ObjRec {
    const o = (objects as any)?.[id];
    return o ? (o as ObjRec) : null;
}

function toEngineBody(id: ObjId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function nearEq(a: number, b: number, epsAbs: number, epsRel: number) {
    const d = Math.abs(a - b);
    const s = Math.max(1, Math.abs(a), Math.abs(b));
    return d <= Math.max(epsAbs, epsRel * s);
}

function roundToMinuteMs(ts: number): number {
    return Math.round(ts / 60_000) * 60_000;
}

function roundToMinuteMonotonic(t: number[]): number[] {
    const out = t.map(roundToMinuteMs);
    for (let i = 1; i < out.length; i++) {
        if (out[i] < out[i - 1]) out[i] = out[i - 1];
    }
    return out;
}

// ---------------------------
// Engine position providers
// ---------------------------

function helioVec(id: ObjId, ts: number): Vec | null {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));

    if (id === 'Sun') return { x: 0, y: 0, z: 0 };

    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(toEngineBody(id), t);
            if (v && isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z)) {
                return { x: v.x, y: v.y, z: v.z };
            }
        }
    } catch {}

    // Moon fallback: Moon heliocentric = Earth heliocentric + Moon geocentric
    if (id === 'Moon') {
        try {
            const vE = helioVec('Earth' as ObjId, ts);
            if (!vE) return null;

            if (typeof (Astronomy as any).GeoVector === 'function') {
                const vM = (Astronomy as any).GeoVector(toEngineBody('Moon'), t, false);
                if (vM && isFiniteNumber(vM.x) && isFiniteNumber(vM.y) && isFiniteNumber(vM.z)) {
                    return { x: vE.x + vM.x, y: vE.y + vM.y, z: vE.z + vM.z };
                }
            }
        } catch {}
    }

    return null;
}

function sub(a: Vec, b: Vec): Vec {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norm(a: Vec): number {
    return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec): Vec | null {
    const m = norm(a);
    if (!(m > 0) || !isFiniteNumber(m)) return null;
    return { x: a.x / m, y: a.y / m, z: a.z / m };
}

// ---------------------------
// Direction from looker to obj
// ---------------------------

function dirFromLookerToEngine(looker: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    const pL = helioVec(looker, ts);
    const pB = helioVec(obj, ts);
    if (!pL || !pB) return null;

    const v = sub(pB, pL);
    const d = norm(v);
    const u = normalize(v);
    if (!u) return null;

    return { u, distAu: d };
}

function dirFromLookerToReference(objId: ObjId): { u: Vec; distAu: number } | null {
    const o = getObj(objId);
    const meta = o?.meta as ReferenceMeta | undefined;
    if (!meta) return null;

    const u3 = refUnit(meta);
    if (!u3) return null;

    return { u: { x: u3[0], y: u3[1], z: u3[2] }, distAu: NaN };
}

function dirFromLooker(looker: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    const rec = getObj(obj);
    if (rec?.kind === 'reference') return dirFromLookerToReference(obj);
    return dirFromLookerToEngine(looker, obj, ts);
}

// ---------------------------
// Phase definition (plane longitudes; default ecliptic)
// ---------------------------

function phaseDeg(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number,
): { phi: number; dT: number; dF: number } | null {
    const dF = dirFromLooker(looker, focus, ts);
    const dT = dirFromLooker(looker, target, ts);
    if (!dF || !dT) return null;

    const lonF = lonDegEcliptic(dF.u);
    const lonT = lonDegEcliptic(dT.u);
    const phi = norm360(lonT - lonF);

    return { phi, dT: dT.distAu, dF: dF.distAu };
}

// ---------------------------
// Direction detection + forward phase
// ---------------------------

function detectMotionDir(
    phiAt: (t: number) => number,
    ts: number,
): { motion: 'ccw' | 'cw'; speedDegPerDayAbs: number } | null {
    const dts = [30 * 60_000, 3 * 60 * 60_000, 24 * 60 * 60_000];

    for (const dt of dts) {
        const a = phiAt(ts - dt);
        const b = phiAt(ts + dt);
        if (!isFiniteNumber(a) || !isFiniteNumber(b)) continue;

        const d = toSigned180(norm360(b - a));
        if (!isFiniteNumber(d) || Math.abs(d) < 1e-9) continue;

        const motion: 'ccw' | 'cw' = d > 0 ? 'ccw' : 'cw';

        const speedDegPerMsAbs = Math.abs(d) / (2 * dt);
        const speedDegPerDayAbs = speedDegPerMsAbs * DAY_MS;

        if (speedDegPerDayAbs > 720) continue;

        return { motion, speedDegPerDayAbs };
    }

    return null;
}

function forwardPhase(phiRaw: number, motion: 'ccw' | 'cw'): number {
    const p = norm360(phiRaw);
    return motion === 'ccw' ? p : norm360(360 - p);
}

// ---------------------------
// Directed crossing (scan + bisection) on g(t)=signedDiff(θ_mod, targetDeg)
// ---------------------------

function signedDiffToTarget(thetaMod: number, targetDeg: number): number {
    // in [-180..180]
    return toSigned180(norm360(thetaMod - targetDeg));
}

function refineCrossingBisection(
    gAt: (t: number) => number,
    tA: number,
    tB: number,
    epsMs: number,
): number | null {
    let lo = Math.min(tA, tB);
    let hi = Math.max(tA, tB);

    let flo = gAt(lo);
    let fhi = gAt(hi);

    if (!isFiniteNumber(flo) || !isFiniteNumber(fhi)) return null;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return null;

    for (let i = 0; i < 120; i++) {
        const mid = 0.5 * (lo + hi);
        const fmid = gAt(mid);
        if (!isFiniteNumber(fmid)) return null;

        if (hi - lo <= epsMs) return mid;

        if (flo * fmid <= 0) {
            hi = mid;
            fhi = fmid;
        } else {
            lo = mid;
            flo = fmid;
        }
    }

    return 0.5 * (lo + hi);
}

type Crossing = { t: number };

function findDirectedCrossingsInWindow(
    thetaModAt: (t: number) => number,
    t0: number,
    t1: number,
    targetDeg: number,
    stepMs: number,
    epsMs: number,
): Crossing[] {
    const out: Crossing[] = [];
    const a = Math.min(t0, t1);
    const b = Math.max(t0, t1);

    const gAt = (t: number) => {
        const th = thetaModAt(t);
        if (!isFiniteNumber(th)) return NaN;
        return signedDiffToTarget(th, targetDeg);
    };

    let tPrev = a;
    let gPrev = gAt(tPrev);
    if (!isFiniteNumber(gPrev)) return out;

    for (let t = a + stepMs; t <= b + 1; t += stepMs) {
        const tt = Math.min(t, b);
        const g = gAt(tt);
        if (!isFiniteNumber(g)) {
            tPrev = tt;
            gPrev = g;
            if (tt >= b) break;
            continue;
        }

        // directed for increasing θ_mod: g < 0 -> g >= 0
        const crosses = (gPrev < 0 && g >= 0) || g === 0 || gPrev === 0;

        if (crosses) {
            const solved = refineCrossingBisection(gAt, tPrev, tt, epsMs);
            if (isFiniteNumber(solved)) out.push({ t: solved as number });
        }

        tPrev = tt;
        gPrev = g;

        if (tt >= b) break;
    }

    out.sort((x, y) => x.t - y.t);

    // de-dupe
    const uniq: Crossing[] = [];
    for (const c of out) {
        if (!uniq.length || Math.abs(uniq[uniq.length - 1].t - c.t) > epsMs * 2) uniq.push(c);
    }

    return uniq;
}

function pickEandEnext(ts: number, crossings: Crossing[]): { E: number; E_next: number } | null {
    if (!crossings.length) return null;

    let E: number | null = null;
    let E_next: number | null = null;

    for (const c of crossings) {
        if (c.t <= ts) E = c.t;
        else {
            E_next = c.t;
            break;
        }
    }

    if (!isFiniteNumber(E) || !isFiniteNumber(E_next)) return null;
    if (!(E < E_next)) return null;

    return { E, E_next };
}

// ---------------------------
// Anchored unwrap θ_unwrap(t) in [90..450) for this cycle
// ---------------------------
//
// Key: endpoints E and E_next both have θ_mod≈90, so unwrap must be time-anchored.
//
function makeThetaUnwrapAt(thetaModAt: (t: number) => number, E_t: number) {
    const EPS_DEG = 1e-4;
    const EPS_MS = 2; // treat exact E as special

    return (t: number): number => {
        const th = thetaModAt(t);
        if (!isFiniteNumber(th)) return NaN;

        const p = norm360(th);

        if (Math.abs(t - E_t) <= EPS_MS) return 90;

        // After E: values near/below 90 are “wrapped” part -> +360
        if (t > E_t) {
            if (p <= 90 + EPS_DEG) return p + 360;
            return p;
        }

        // Before E: keep as-is (rarely used after we bracket E..E_next)
        return p;
    };
}

// ---------------------------
// Solve time for target θ_unwrap by bisection in [E..E_next]
// ---------------------------

function solveTimeForThetaUnwrap(
    thetaUnwrapAt: (t: number) => number,
    t0: number,
    t1: number,
    targetU: number,
    opts: SolveOpts,
): number | null {
    const dbg = opts.dbg;
    const maxIters = opts.maxIters ?? 180;
    const epsMs = opts.epsMs ?? 1_000;

    let a = Math.min(t0, t1);
    let b = Math.max(t0, t1);

    let fa = thetaUnwrapAt(a) - targetU;
    let fb = thetaUnwrapAt(b) - targetU;

    if (!isFiniteNumber(fa) || !isFiniteNumber(fb)) return null;

    if (fa === 0) return a;
    if (fb === 0) return b;

    if (fa * fb > 0) {
        dbg?.warn?.('synod.solve.unwrap.not-bracketed', { a: fmt(a), b: fmt(b), fa, fb, targetU });
        return null;
    }

    for (let i = 0; i < maxIters; i++) {
        const mid = 0.5 * (a + b);
        const fm = thetaUnwrapAt(mid) - targetU;
        if (!isFiniteNumber(fm)) return null;

        if (b - a <= epsMs) return mid;

        if (fa * fm <= 0) {
            b = mid;
            fb = fm;
        } else {
            a = mid;
            fa = fm;
        }
    }

    return 0.5 * (a + b);
}

// ---------------------------
// Main solver
// ---------------------------

export function solveSynodWheel(input: WheelInput<'synod'>): CycleSolveResult<SynodMeta> {
    const dbg = input.dbg;

    const fail = (reason: string): CycleSolveResult<SynodMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    const ts = input.ts;

    if (!input.looker) return fail('Synod wheel requires looker');
    if (!input.focus) return fail('Synod wheel requires focus');
    if (!input.target) return fail('Synod wheel requires target');

    const looker: ObjId = input.looker;
    const focus: ObjId = input.focus;
    const target: ObjId = Array.isArray(input.target) ? input.target[0] : input.target;

    if (!target) return fail('Synod wheel requires a single target');

    const phiRawAt = (t: number) => {
        const r = phaseDeg(looker, focus, target, t);
        return r ? r.phi : NaN;
    };

    const phi0 = phiRawAt(ts);
    if (!isFiniteNumber(phi0)) {
        return fail(`Synod wheel: cannot compute phase for looker=${String(looker)} focus=${String(focus)} target=${String(target)}`);
    }

    const dirInfo = detectMotionDir(phiRawAt, ts);
    if (!dirInfo) return fail('Synod wheel: failed to detect phase motion direction near ts');

    const motion: 'ccw' | 'cw' = dirInfo.motion;
    const speedDegPerDayAbs = dirInfo.speedDegPerDayAbs;

    const thetaModAt = (t: number) => {
        const p = phiRawAt(t);
        if (!isFiniteNumber(p)) return NaN;
        return forwardPhase(p, motion);
    };

    // Adaptive scan step: aim ~20° phase per step; clamp to safe bounds.
    const desiredDeg = 20;
    const stepDays = desiredDeg / Math.max(1e-12, speedDegPerDayAbs);
    const stepMs = clamp(stepDays * DAY_MS, 10 * 60_000, 30 * DAY_MS);

    // Bisection epsilon based on step; clamp.
    const epsMs = clamp(stepMs / 128, 50, 5_000);

    // Estimated period for initial window (just a hint; expansion handles reality).
    const estPeriodDays = 360 / Math.max(1e-12, speedDegPerDayAbs);
    let halfWindowMs = clamp(estPeriodDays * DAY_MS * 0.75, 4 * stepMs, 25_000 * DAY_MS);

    dbg?.log?.('synod.v5.params', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        phi0,
        theta0: thetaModAt(ts),
        speedDegPerDayAbs: Number(speedDegPerDayAbs.toFixed(9)),
        stepMs,
        epsMs,
        estPeriodDays: Number(estPeriodDays.toFixed(6)),
        halfWindowDays: Number((halfWindowMs / DAY_MS).toFixed(6)),
    });

    // Find E/E_next as directed crossings of θ=90 around ts (expand window until found).
    let E_t: number | null = null;
    let E_next_t: number | null = null;

    for (let attempt = 0; attempt < 18; attempt++) {
        const t0 = ts - halfWindowMs;
        const t1 = ts + halfWindowMs;

        const crossings = findDirectedCrossingsInWindow(thetaModAt, t0, t1, 90, stepMs, epsMs);
        const picked = pickEandEnext(ts, crossings);

        dbg?.log?.('synod.v5.crossings', {
            attempt,
            t0: fmt(t0),
            t1: fmt(t1),
            halfWindowDays: Number((halfWindowMs / DAY_MS).toFixed(6)),
            crossingsCount: crossings.length,
            picked: picked ? { E: fmt(picked.E), E_next: fmt(picked.E_next) } : null,
        });

        if (picked) {
            E_t = picked.E;
            E_next_t = picked.E_next;
            break;
        }

        halfWindowMs = clamp(halfWindowMs * 1.7, 4 * stepMs, 60_000 * DAY_MS);
    }

    if (!isFiniteNumber(E_t) || !isFiniteNumber(E_next_t) || !(E_t! < E_next_t!)) {
        return fail('Synod wheel: failed to locate E/E_next (θ=90° crossings) around ts');
    }

    const tE = E_t as number;
    const tE2 = E_next_t as number;

    const thetaUnwrapAt = makeThetaUnwrapAt(thetaModAt, tE);

    const thetaE = thetaUnwrapAt(tE);
    const thetaE2 = thetaUnwrapAt(tE2);

    dbg?.log?.('synod.v5.boundary', {
        E: fmt(tE),
        E_next: fmt(tE2),
        thetaModE: thetaModAt(tE),
        thetaModE2: thetaModAt(tE2),
        thetaUnwrapE: thetaE,
        thetaUnwrapE2: thetaE2,
        spanDays: Number(((tE2 - tE) / DAY_MS).toFixed(9)),
    });

    // Expect E≈90 and E_next≈450 in unwrap space; warn-only.
    if (isFiniteNumber(thetaE) && Math.abs(thetaE - 90) > 0.2) dbg?.warn?.('synod.v5.boundary.E.off', { thetaE, E: fmt(tE) });
    if (isFiniteNumber(thetaE2) && Math.abs(thetaE2 - 450) > 0.2) dbg?.warn?.('synod.v5.boundary.E_next.off', { thetaE2, E_next: fmt(tE2) });

    const OPT_SOLVE: SolveOpts = {
        maxIters: 220,
        epsMs,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    function wantThetaUnwrapForIndex(i: number): number {
        // i=0..16 => 90..450
        return 90 + (360 * i) / 16;
    }

    // Solve spokes (exact times)
    const tExact: number[] = new Array(17);
    tExact[0] = tE;
    tExact[16] = tE2;

    for (let i = 1; i < 16; i++) {
        const wantU = wantThetaUnwrapForIndex(i);
        const solved = solveTimeForThetaUnwrap(thetaUnwrapAt, tE, tE2, wantU, OPT_SOLVE);

        if (!isFiniteNumber(solved)) {
            dbg?.warn?.('synod.v5.spoke.solve.failed', { i, code: SPOKES_ORDER[i], wantU, fallback: 'lerp' });
        }

        tExact[i] = isFiniteNumber(solved) ? (solved as number) : lerp(tE, tE2, i / 16);
    }

    // monotonic exact times check (warn-only)
    for (let i = 1; i < tExact.length; i++) {
        if (!(tExact[i] >= tExact[i - 1])) {
            dbg?.warn?.('synod.v5: non-monotonic exact times', {
                i,
                prev: { i: i - 1, t: fmt(tExact[i - 1]), code: SPOKES_ORDER[i - 1] ?? String(i - 1) },
                cur: { i, t: fmt(tExact[i]), code: SPOKES_ORDER[i] ?? String(i) },
                E: fmt(tE),
                E_next: fmt(tE2),
                motion,
            });
            break;
        }
    }

    // Angle hit check (exact): compare θ_unwrap(t) to wanted.
    for (let i = 0; i < tExact.length; i++) {
        const wantU = wantThetaUnwrapForIndex(i);
        const gotU = thetaUnwrapAt(tExact[i]);
        if (!isFiniteNumber(gotU)) {
            dbg?.warn?.('synod.v5.angle.NaN', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU });
            continue;
        }
        const err = Math.abs(gotU - wantU);
        if (err > 0.25) {
            dbg?.warn?.('synod.v5.angle.mismatch', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU, gotU, err, motion });
        } else if (i === 0 || i === 4 || i === 8 || i === 12 || i === 16) {
            dbg?.log?.('synod.v5.angle.ok', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU, gotU, err });
        }
    }

    // Final output times (rounded)
    const tOut = roundToMinuteMonotonic(tExact);

    function mkSpoke(i: number): CycleSpoke<SynodMeta> {
        const wantUn = wantThetaUnwrapForIndex(i);
        const wantFwd = norm360(wantUn);

        const tSolve = tExact[i];
        const tDisplay = tOut[i];

        const r = phaseDeg(looker, focus, target, tSolve);
        const raw = r?.phi ?? NaN;

        const rAu = isFiniteNumber(r?.dT) ? r!.dT : NaN;
        const rKm = isFiniteNumber(rAu) ? rAu * AU_KM : NaN;

        return {
            ts: tDisplay,
            code: SPOKES_ORDER[i] ?? (i === 16 ? 'E+' : 'E'),
            index: i,
            meta: {
                phaseDeg: isFiniteNumber(raw) ? raw : NaN,
                phaseForwardDeg: wantFwd,
                phaseUnwrapDeg: wantUn,
                motion,
                distanceAu: rAu,
                distanceKm: rKm,
                focusDistAu: isFiniteNumber(r?.dF) ? r!.dF : NaN,
            },
        };
    }

    const spokes: CycleSpoke<SynodMeta>[] = [];
    for (let i = 0; i < 17; i++) spokes.push(mkSpoke(i));

    // Endpoint sanity (minute-rounded)
    if (spokes[0] && !nearEq(spokes[0].ts, roundToMinuteMs(tE), 60_000, 0)) {
        dbg?.warn?.('synod.v5: spoke[0] minute-round differs from E (expected sometimes)', { spoke0: fmt(spokes[0].ts), E: fmt(tE) });
    }
    if (spokes[16] && !nearEq(spokes[16].ts, roundToMinuteMs(tE2), 60_000, 0)) {
        dbg?.warn?.('synod.v5: spoke[16] minute-round differs from E_next (expected sometimes)', {
            spoke16: fmt(spokes[16].ts),
            E_next: fmt(tE2),
        });
    }

    dbg?.log?.('synod.v5.done', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        E: fmt(tE),
        E_next: fmt(tE2),
        durationDays: Number(((tE2 - tE) / DAY_MS).toFixed(9)),
        spokeTs0: fmt(spokes[0]?.ts),
        spokeTs16: fmt(spokes[16]?.ts),
    });

    return { ok: true, kind: 'cycle', ts, spokes };
}