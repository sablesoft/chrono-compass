import type { CycleSolveResult, CycleSpoke, WheelInput } from '../board/runtime';
import { isReferenceLikeKind, objects, type ObjId, type ReferenceMeta } from '../catalog';
import { cycleSpokeTags } from '../catalog/tags';
import { debug } from '../debug';
import { ms } from '../format';
import { buildSpokeTimes, type Anchors } from '../wheel/spokes';
import { isTsWithinWheelTimeframe } from '../wheel/timeframe';
import { SPOKES_ORDER } from '../wheel/types';
import { angleFromAnchors } from './deprecated/angle';
import { clamp, DAY_MS, findExtremumInWindowGold, fmt, isFiniteNumber } from './helpers';
import { refUnit } from './vector';

type PlatoMeta = {
    deviationDeg: number;
    deviationRad: number;
    currentTsDeviationDeg: number;
    currentTsDeviationRad: number;
    anchorCode: 'N' | 'S';
    oppositeCode: 'N' | 'S';
};
type PlatoInstantMeta = {
    currentTsDeviationDeg: number;
    currentTsDeviationRad: number;
    anchorCode: 'N' | 'S';
    oppositeCode: 'N' | 'S';
};
type V3 = { x: number; y: number; z: number };

const dbg = debug('plato', '🧭');
const { group, log, warn } = dbg;

function dot(a: V3, b: V3) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: V3, b: V3): V3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}
function add(a: V3, b: V3): V3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a: V3, k: number): V3 { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function norm(a: V3) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a: V3): V3 {
    const n = norm(a);
    return n > 0 ? scale(a, 1 / n) : { x: 0, y: 0, z: 0 };
}

function normalizeSafeDbg(a: V3, fallback: V3, label: string): V3 {
    const n = norm(a);
    if (n > 1e-12) return scale(a, 1 / n);
    warn(`${label}: near-zero vector, fallback`, { a, fallback });
    return fallback;
}

function rotateAroundAxis(v: V3, kUnit: V3, rad: number): V3 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const term1 = scale(v, c);
    const term2 = scale(cross(kUnit, v), s);
    const term3 = scale(kUnit, dot(kUnit, v) * (1 - c));
    return add(add(term1, term2), term3);
}

function degToRad(d: number) { return (d * Math.PI) / 180; }

function raDecToUnit(raRad: number, decRad: number): V3 {
    const c = Math.cos(decRad);
    return normalize({
        x: c * Math.cos(raRad),
        y: c * Math.sin(raRad),
        z: Math.sin(decRad),
    });
}

function projectToPlane(v: V3, nUnit: V3): V3 {
    const k = dot(v, nUnit);
    return add(v, scale(nUnit, -k));
}

function orientedAngle(a: V3, b: V3, nUnit: V3) {
    const axb = cross(a, b);
    const y = dot(nUnit, axb);
    const x = dot(a, b);
    return Math.atan2(y, x);
}

function angleBetweenUnit(a: V3, b: V3): number {
    return Math.acos(clamp(dot(a, b), -1, 1));
}

function currentAnchorCode(ts: number, lookerUnit: V3): 'N' | 'S' {
    // Celestial-equator anchor selection: compare looker direction to Earth's
    // instantaneous rotation axis (normal of the true celestial equator model used here).
    return dot(lookerUnit, earthAxisAt(ts)) >= 0 ? 'N' : 'S';
}

const RA_GC = degToRad((17 + 45 / 60 + 40.04 / 3600) * 15);
const DEC_GC = degToRad(-(29 + 0 / 60 + 28.1 / 3600));
const DEFAULT_LOOKER = raDecToUnit(RA_GC, DEC_GC);

const EPS = degToRad(23.439291);
const ECL_POLE: V3 = normalize({ x: 0, y: -Math.sin(EPS), z: Math.cos(EPS) });
const PRECESSION_BELT_HALF_WIDTH_RAD = EPS;
const PRECESSION_BELT_EPS_RAD = 1e-12;

const MS_PER_YEAR = 365.2422 * 86400_000;
const PRECESSION_YEARS = 25772;
const PERIOD_MS = PRECESSION_YEARS * MS_PER_YEAR;

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
const PRECESSION_RAD_PER_MS = (2 * Math.PI) / PERIOD_MS;

const SOUTH_SHIFT = 0.75;
const NORTH_SHIFT = 0.25;

function earthAxisAt(ts: number): V3 {
    const psi = -(ts - J2000_MS) * PRECESSION_RAD_PER_MS;
    const base: V3 = { x: 0, y: 0, z: 1 };
    return normalize(rotateAroundAxis(base, ECL_POLE, psi));
}

export function getPlatoPhaseRad(ts: number) {
    return getPlatoPhaseRadForLooker(ts, DEFAULT_LOOKER);
}

function getPlatoPhaseRadForLooker(ts: number, lookerUnit: V3) {
    ts = ms(ts);

    return group(`phase ts=${new Date(ts).toISOString()}`, () => {
        const p = earthAxisAt(ts);
        const pProj = projectToPlane(p, ECL_POLE);
        const gProj = projectToPlane(lookerUnit, ECL_POLE);
        const pSafe = normalizeSafeDbg(pProj, { x: 1, y: 0, z: 0 }, 'Pproj');
        const gSafe = normalizeSafeDbg(gProj, { x: 0, y: 1, z: 0 }, 'Gproj');
        const ang = orientedAngle(pSafe, gSafe, ECL_POLE);

        log('phase', {
            ts: new Date(ts).toISOString(),
            angRad: ang,
            angDeg: ang * 180 / Math.PI,
        });

        return ang;
    });
}

function lookerUnitById(looker: ObjId | undefined): V3 {
    if (!looker) return DEFAULT_LOOKER;
    const rec = (objects as any)?.[looker] as { kind?: string; meta?: ReferenceMeta } | undefined;
    if (!rec || !isReferenceLikeKind(rec.kind as any)) return DEFAULT_LOOKER;
    const u3 = rec.meta ? refUnit(rec.meta) : null;
    if (!u3) return DEFAULT_LOOKER;
    return normalize({ x: u3[0], y: u3[1], z: u3[2] });
}

function lookerEclipticLatitudeRad(lookerUnit: V3): number {
    return Math.asin(clamp(dot(lookerUnit, ECL_POLE), -1, 1));
}

function isLookerOutsidePrecessionBelt(lookerUnit: V3): boolean {
    return Math.abs(lookerEclipticLatitudeRad(lookerUnit)) > (PRECESSION_BELT_HALF_WIDTH_RAD + PRECESSION_BELT_EPS_RAD);
}

export function platoLookerAnchor(looker?: ObjId, ts: number = Date.now()): 'N' | 'S' {
    const lookerUnit = lookerUnitById(looker);
    return currentAnchorCode(ms(ts), lookerUnit);
}

export function platoCurrentDeviationDegAt(looker: ObjId | undefined, ts: number = Date.now()): number {
    const safeTs = ms(ts);
    const lookerUnit = lookerUnitById(looker);
    if (!isLookerOutsidePrecessionBelt(lookerUnit)) return NaN;
    const anchorCode = currentAnchorCode(safeTs, lookerUnit);
    const deviationRad = deviationAt(safeTs, lookerUnit, anchorCode);
    return deviationRad * 180 / Math.PI;
}

type Ext = { t: number; v: number };

function axisByAnchorAt(ts: number, anchorCode: 'N' | 'S'): V3 {
    const northAxis = earthAxisAt(ts);
    if (anchorCode === 'N') return northAxis;
    return scale(northAxis, -1);
}

function deviationAt(ts: number, lookerUnit: V3, anchorCode: 'N' | 'S'): number {
    return angleBetweenUnit(axisByAnchorAt(ts, anchorCode), lookerUnit);
}

function findMinimumNear(centerTs: number, halfWindow: number, valueAt: (t: number) => number): Ext | null {
    if (!isFiniteNumber(centerTs) || !isFiniteNumber(halfWindow) || !(halfWindow > 0)) return null;

    // Stage 1: robust coarse scan with adaptive step.
    // Fixed point count is too rough for very wide windows (multi-year step),
    // so keep step bounded in days to avoid year-scale minimum drift.
    const COARSE_STEP_TARGET_DAYS = 20;
    const COARSE_STEP_MAX_DAYS = 45;
    const COARSE_MAX_SAMPLES = 300_001;
    const t0 = centerTs - halfWindow;
    const t1 = centerTs + halfWindow;
    const spanMs = t1 - t0;
    const targetStepMs = COARSE_STEP_TARGET_DAYS * DAY_MS;
    const maxStepMs = COARSE_STEP_MAX_DAYS * DAY_MS;
    let coarseCount = Math.ceil(spanMs / targetStepMs) + 1;
    if (!isFiniteNumber(coarseCount) || coarseCount < 3) coarseCount = 3;
    coarseCount = Math.min(COARSE_MAX_SAMPLES, Math.max(3, coarseCount));
    let dt = spanMs / (coarseCount - 1);
    if (dt > maxStepMs) {
        coarseCount = Math.min(COARSE_MAX_SAMPLES, Math.ceil(spanMs / maxStepMs) + 1);
        dt = spanMs / (coarseCount - 1);
    }
    let bestT = NaN;
    let bestV = Number.POSITIVE_INFINITY;
    for (let i = 0; i < coarseCount; i++) {
        const t = t0 + dt * i;
        const v = valueAt(t);
        if (!isFiniteNumber(v)) continue;
        if (v < bestV) {
            bestV = v;
            bestT = t;
        }
    }
    if (!isFiniteNumber(bestT) || !isFiniteNumber(bestV)) return null;

    // Stage 2: local refinement near coarse minimum candidate.
    const localHalf = Math.max(12 * 60 * 60_000, dt * 6);
    const ext = findExtremumInWindowGold(valueAt, bestT, localHalf);
    const refinedT = (ext && isFiniteNumber(ext.t)) ? ext.t : bestT;
    const refinedV = (ext && isFiniteNumber(ext.v)) ? ext.v : bestV;

    // Do not require strict local-minimum validation here.
    // Around flat regions the value can be near-constant and strict checks
    // may reject a valid nearest candidate.
    if (!isFiniteNumber(refinedT) || !isFiniteNumber(refinedV)) return null;
    return { t: ms(refinedT), v: refinedV };
}

function findNearestMinimumWithNeighbors(ts: number, lookerUnit: V3, anchorCode: 'N' | 'S', looker?: ObjId): {
    minimum: Ext;
    prev: Ext;
    next: Ext;
    periodMs: number;
} | null {
    const valueAt = (t: number) => deviationAt(t, lookerUnit, anchorCode);
    const thirdStep = PERIOD_MS / 3;
    const halfWindow = thirdStep * 0.6;
    const centers = [ts - thirdStep, ts, ts + thirdStep];

    const candidates = centers
        .map((center) => findMinimumNear(center, halfWindow, valueAt))
        .filter((x): x is Ext => !!x)
        .sort((a, b) => a.t - b.t)
        .filter((row, i, arr) => i === 0 || Math.abs(row.t - arr[i - 1].t) > DAY_MS);
    if (!candidates.length) {
        warn('plato.min.search.noCandidates', {
            ts: fmt(ts),
            looker: looker ?? null,
            anchorCode,
            centers: centers.map((x) => fmt(x)),
            halfWindowDays: Number((halfWindow / DAY_MS).toFixed(3)),
            reason: 'findMinimumNear returned null for all windows',
        });
        return null;
    }

    const minimum = candidates.reduce((best, row) =>
        Math.abs(row.t - ts) < Math.abs(best.t - ts) ? row : best
    );
    log('plato.min.search.candidates', {
        ts: fmt(ts),
        looker: looker ?? null,
        anchorCode,
        halfWindowDays: Number((halfWindow / DAY_MS).toFixed(3)),
        candidates: candidates.map((c) => ({
            t: fmt(c.t),
            vDeg: Number((c.v * 180 / Math.PI).toFixed(6)),
            dtDays: Number(((c.t - ts) / DAY_MS).toFixed(3)),
        })),
        selected: fmt(minimum.t),
    });

    const prev = findMinimumNear(minimum.t - PERIOD_MS, halfWindow, valueAt);
    const next = findMinimumNear(minimum.t + PERIOD_MS, halfWindow, valueAt);
    if (!prev || !next) {
        warn('plato.min.search.neighborsMissing', {
            ts: fmt(ts),
            looker: looker ?? null,
            anchorCode,
            minimum: { t: fmt(minimum.t), v: minimum.v },
            hasPrev: !!prev,
            hasNext: !!next,
            probePeriodDays: Number((PERIOD_MS / DAY_MS).toFixed(3)),
        });
        return null;
    }
    if (!(prev.t < minimum.t && minimum.t < next.t)) {
        warn('plato.min.search.orderInvalid', {
            ts: fmt(ts),
            looker: looker ?? null,
            anchorCode,
            prev: fmt(prev.t),
            minimum: fmt(minimum.t),
            next: fmt(next.t),
        });
        return null;
    }

    const periodPrev = minimum.t - prev.t;
    const periodNext = next.t - minimum.t;
    const periodMs = (periodPrev + periodNext) / 2;
    if (!isFiniteNumber(periodMs) || !(periodMs > 0)) {
        warn('plato.min.search.periodInvalid', {
            ts: fmt(ts),
            looker: looker ?? null,
            anchorCode,
            prev: fmt(prev.t),
            minimum: fmt(minimum.t),
            next: fmt(next.t),
            periodPrevDays: Number((periodPrev / DAY_MS).toFixed(6)),
            periodNextDays: Number((periodNext / DAY_MS).toFixed(6)),
        });
        return null;
    }

    return { minimum, prev, next, periodMs };
}

export function getPlatoAnchors(ts: number, looker?: ObjId): Anchors | null {
    ts = ms(ts);
    const lookerUnit = lookerUnitById(looker);
    if (!isLookerOutsidePrecessionBelt(lookerUnit)) {
        warn('plato.anchors.invalidLooker.precessionBelt', {
            ts: fmt(ts),
            looker: looker ?? null,
            lookerEclipticLatDeg: Number((lookerEclipticLatitudeRad(lookerUnit) * 180 / Math.PI).toFixed(6)),
            beltHalfWidthDeg: Number((PRECESSION_BELT_HALF_WIDTH_RAD * 180 / Math.PI).toFixed(6)),
        });
        return null;
    }
    const anchorCode = currentAnchorCode(ts, lookerUnit);
    const anchorShift = anchorCode === 'N' ? NORTH_SHIFT : SOUTH_SHIFT;

    return group(`anchors ts=${new Date(ts).toISOString()}`, () => {
        const cycle = findNearestMinimumWithNeighbors(ts, lookerUnit, anchorCode, looker);
        if (!cycle) {
            warn('plato.anchors.findMinimum.failed', {
                ts: fmt(ts),
                looker: looker ?? null,
                anchorCode,
            });
            return null;
        }

        const { minimum, prev, next, periodMs } = cycle;
        let start = ms(minimum.t - anchorShift * periodMs);
        let end = ms(start + periodMs);

        while (ts < start) {
            start = ms(start - periodMs);
            end = ms(end - periodMs);
        }
        while (ts >= end) {
            start = ms(start + periodMs);
            end = ms(end + periodMs);
        }

        const anchors: Anchors = {
            start,
            end,
            E: start,
            N: ms(start + periodMs * 0.25),
            W: ms(start + periodMs * 0.50),
            S: ms(start + periodMs * 0.75),
            E_next: end,
        };

        log('anchors selected', {
            ts: fmt(ts),
            looker: looker ?? null,
            anchorCode,
            nearestMin: fmt(minimum.t),
            prevMin: fmt(prev.t),
            nextMin: fmt(next.t),
            periodDays: Number((periodMs / DAY_MS).toFixed(6)),
            start: fmt(start),
            end: fmt(end),
            N: fmt(anchors.N),
            S: fmt(anchors.S),
        });

        return anchors;
    });
}

export const angleFromPlatoAnchors = angleFromAnchors;

export function shiftPlatoCycle(cycleStartTs: number, dir: -1 | 1) {
    const from = ms(cycleStartTs);
    const to = ms(from + dir * PERIOD_MS);

    log('shiftCycle', {
        dir,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
    });

    return to;
}

function toTargetId(target: ObjId | ObjId[]): ObjId | null {
    if (Array.isArray(target)) return (target[0] as ObjId | undefined) ?? null;
    return target ?? null;
}

function anchorsToSpokes(
    a: Anchors,
    lookerUnit: V3,
    anchorCode: 'N' | 'S',
    instant: PlatoInstantMeta
): CycleSpoke<PlatoMeta>[] | null {
    const times = buildSpokeTimes(a);
    if (!Array.isArray(times) || times.length !== 17) return null;

    const anchorIndex = SPOKES_ORDER.findIndex((code) => code === anchorCode);
    if (anchorIndex < 0 || anchorIndex >= times.length) return null;
    const anchorTs = times[anchorIndex];
    if (!isFiniteNumber(anchorTs)) return null;

    const out: CycleSpoke<PlatoMeta>[] = [];
    for (let i = 0; i < 17; i++) {
        const ts = times[i];
        const code = SPOKES_ORDER[i] ?? (i === 16 ? 'E_next' : 'E');
        if (!isFiniteNumber(ts)) return null;
        if (i > 0 && !(ts > times[i - 1])) return null;
        const deviationRad = deviationAt(ts, lookerUnit, anchorCode);
        out.push({
            ts,
            code,
            index: i,
            tags: cycleSpokeTags('plato', code),
            meta: {
                deviationDeg: deviationRad * 180 / Math.PI,
                deviationRad: deviationRad,
                currentTsDeviationDeg: instant.currentTsDeviationDeg,
                currentTsDeviationRad: instant.currentTsDeviationRad,
                anchorCode: instant.anchorCode,
                oppositeCode: instant.oppositeCode,
            },
        });
    }
    return out;
}

function buildPlatoInstantMeta(ts: number, looker?: ObjId): PlatoInstantMeta {
    const safeTs = ms(ts);
    const lookerUnit = lookerUnitById(looker);
    const anchorCode = currentAnchorCode(safeTs, lookerUnit);
    const oppositeCode = anchorCode === 'N' ? 'S' : 'N';
    const anchors = getPlatoAnchors(safeTs, looker);
    if (!anchors) {
        return {
            anchorCode,
            oppositeCode,
            currentTsDeviationDeg: NaN,
            currentTsDeviationRad: NaN,
        };
    }

    const tsDeviationRad = deviationAt(safeTs, lookerUnit, anchorCode);

    return {
        anchorCode,
        oppositeCode,
        currentTsDeviationDeg: tsDeviationRad * 180 / Math.PI,
        currentTsDeviationRad: tsDeviationRad,
    };
}

export function solvePlatoWheel(input: WheelInput<'plato'>): CycleSolveResult<PlatoMeta> {
    const ts = input.ts;
    const fail = (reason: string): CycleSolveResult<PlatoMeta> => ({
        ok: false,
        kind: 'cycle',
        ts,
        reason,
        spokes: [],
    });

    const looker = input.looker as ObjId | undefined;
    const target = toTargetId(input.target as ObjId | ObjId[]);

    if (!looker || target !== 'Earth') {
        return fail('Plato wheel: invalid roles (requires looker reference and target=Earth)');
    }

    const lookerObj = (objects as any)?.[looker] as { kind?: string } | undefined;
    if (!lookerObj || !isReferenceLikeKind(lookerObj.kind as any)) {
        return fail('Plato wheel: looker must be a reference object');
    }
    if (!isTsWithinWheelTimeframe(ts)) {
        return fail('Plato wheel: requested timestamp is outside supported timeframe');
    }
    const lookerUnit = lookerUnitById(looker);
    if (!isLookerOutsidePrecessionBelt(lookerUnit)) {
        const betaDeg = lookerEclipticLatitudeRad(lookerUnit) * 180 / Math.PI;
        const beltHalfWidthDeg = PRECESSION_BELT_HALF_WIDTH_RAD * 180 / Math.PI;
        return fail(
            `Plato wheel: looker lies inside precession belt (|ecliptic latitude|=${Math.abs(betaDeg).toFixed(3)}° <= ${beltHalfWidthDeg.toFixed(3)}°).`
        );
    }

    const anchors = getPlatoAnchors(ts, looker);
    if (!anchors) return fail('Plato wheel: failed to locate deviation minima around ts');
    const anchorCode = currentAnchorCode(ts, lookerUnit);
    const instantMeta = buildPlatoInstantMeta(ts, looker);
    const spokes = anchorsToSpokes(anchors, lookerUnit, anchorCode, instantMeta);
    if (!spokes) return fail('Plato wheel: failed to build spokes from anchors');

    return {
        ok: true,
        kind: 'cycle',
        ts,
        spokes,
    };
}
