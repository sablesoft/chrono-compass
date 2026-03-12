// src/lib/cycle/plato.ts
import type { Anchors } from '../../wheel/spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../../format';
import { debug } from '../../debug';
import { objects, type ObjId, type ReferenceMeta } from '../../catalog';
import { refUnit } from '../vector';

const dbg = debug('plato', '🧭');
const { group, log, warn } = dbg;

// -------------------------
// helpers (vectors)
// -------------------------
type V3 = { x: number; y: number; z: number };

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
    warn(`${label}: near-zero vector → fallback`, { a, fallback });
    return fallback;
}

function rotateAroundAxis(v: V3, kUnit: V3, rad: number): V3 {
    const k = kUnit;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const term1 = scale(v, c);
    const term2 = scale(cross(k, v), s);
    const term3 = scale(k, dot(k, v) * (1 - c));
    return add(add(term1, term2), term3);
}

function degToRad(d: number) { return (d * Math.PI) / 180; }

// RA/Dec (radians) -> unit in equatorial frame
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

function normalize01(x: number) {
    let t = x % 1;
    if (t < 0) t += 1;
    return t;
}

// -------------------------
// Constants
// -------------------------

// Galactic center (ICRS/J2000) approx
const RA_GC = degToRad((17 + 45 / 60 + 40.04 / 3600) * 15);
const DEC_GC = degToRad(-(29 + 0 / 60 + 28.1 / 3600));
const DEFAULT_LOOKER = raDecToUnit(RA_GC, DEC_GC);

// Obliquity (J2000)
const EPS = degToRad(23.439291);

// Ecliptic north pole in equatorial J2000
const ECL_POLE: V3 = normalize({ x: 0, y: -Math.sin(EPS), z: Math.cos(EPS) });

// Period (UI)
const MS_PER_YEAR = 365.2422 * 86400_000;
const PRECESSION_YEARS = 25772;
const PERIOD_MS = PRECESSION_YEARS * MS_PER_YEAR;

// J2000 epoch
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);

const PRECESSION_RAD_PER_MS = (2 * Math.PI) / PERIOD_MS;

// GC alignment is SOUTH => φ=0 corresponds to S => +0.75 cycle from E
const SOUTH_SHIFT = 0.75;
const NORTH_SHIFT = 0.25;

// -------------------------
// Earth axis model
// -------------------------
function earthAxisAt(ts: number): V3 {
    const psi = -(ts - J2000_MS) * PRECESSION_RAD_PER_MS;
    // Physical anchor: at J2000 the north Earth axis is +Z in equatorial J2000 frame.
    // Then precession is modeled as uniform rotation around ecliptic pole.
    const base: V3 = { x: 0, y: 0, z: 1 };
    return normalize(rotateAroundAxis(base, ECL_POLE, psi));
}

// -------------------------
// Phase
// -------------------------
export function getPlatoPhaseRad(ts: number) {
    return getPlatoPhaseRadForLooker(ts, DEFAULT_LOOKER);
}

function getPlatoPhaseRadForLooker(ts: number, lookerUnit: V3) {
    ts = ms(ts);

    return group(`phase ts=${new Date(ts).toISOString()}`, () => {
        const P = earthAxisAt(ts);

        const Pproj = projectToPlane(P, ECL_POLE);
        const Gproj = projectToPlane(lookerUnit, ECL_POLE);

        // здесь чаще всего и "умирает" геометрия (если вектор почти параллелен ECL_POLE)
        const Pp = normalizeSafeDbg(Pproj, { x: 1, y: 0, z: 0 }, 'Pproj');
        const Gp = normalizeSafeDbg(Gproj, { x: 0, y: 1, z: 0 }, 'Gproj');

        const ang = orientedAngle(Pp, Gp, ECL_POLE);

        // опционально: логируй только если хочешь видеть, что вообще считается
        log('phase', {
            ts: new Date(ts).toISOString(),
            angRad: ang,
            angDeg: ang * 180 / Math.PI,
        });

        return ang;
    });
}

// -------------------------
// Anchors (stable, boundary-safe)
// -------------------------

function lookerUnitById(looker: ObjId | undefined): V3 {
    if (!looker) return DEFAULT_LOOKER;
    const rec = (objects as any)?.[looker] as { kind?: string; meta?: ReferenceMeta } | undefined;
    if (!rec || rec.kind !== 'reference') return DEFAULT_LOOKER;
    const u3 = rec.meta ? refUnit(rec.meta) : null;
    if (!u3) return DEFAULT_LOOKER;
    return normalize({ x: u3[0], y: u3[1], z: u3[2] });
}

export function platoLookerAnchor(looker?: ObjId): 'N' | 'S' {
    const lookerUnit = lookerUnitById(looker);
    return dot(lookerUnit, ECL_POLE) > 0 ? 'N' : 'S';
}

const e0ByLooker = new Map<string, number>();

function e0ForLooker(lookerUnit: V3, anchorShift: number): number {
    const key = `${lookerUnit.x.toFixed(12)}:${lookerUnit.y.toFixed(12)}:${lookerUnit.z.toFixed(12)}:${anchorShift.toFixed(2)}`;
    const cached = e0ByLooker.get(key);
    if (typeof cached === 'number' && Number.isFinite(cached)) return cached;

    const phi0 = getPlatoPhaseRadForLooker(J2000_MS, lookerUnit);
    if (!Number.isFinite(phi0)) {
        warn('phi0 is not finite at J2000', { phi0 });
    }
    // u0 = fraction of cycle elapsed since E at J2000,
    // where φ=0 is mapped to selected anchor (N or S).
    const u0 = normalize01(phi0 / (2 * Math.PI) + anchorShift);
    // nearest previous E relative to J2000:
    const e0 = ms(J2000_MS - u0 * PERIOD_MS);
    if (!Number.isFinite(e0)) {
        warn('E0 is not finite', { e0, phi0, u0 });
    }
    e0ByLooker.set(key, e0);
    return e0;
}

export function getPlatoAnchors(ts: number, looker?: ObjId): Anchors {
    ts = ms(ts);
    const lookerUnit = lookerUnitById(looker);
    const isNorthAnchor = platoLookerAnchor(looker) === 'N';
    const anchorShift = isNorthAnchor ? NORTH_SHIFT : SOUTH_SHIFT;
    // Phase-origin shift controls what "S/N" means physically.
    // For southern references we align S with the closest SOUTH pole (not north axis),
    // so phase origin is offset by half-cycle relative to north-axis criterion.
    const phaseOriginShift = NORTH_SHIFT;
    const E0 = e0ForLooker(lookerUnit, phaseOriginShift);

    return group(`anchors ts=${new Date(ts).toISOString()}`, () => {
        // If looker is above ecliptic, anchor by nearest N; if below, by nearest S.

        const kCurrent = Math.floor((ts - E0 + 1) / PERIOD_MS);
        let k = Math.round((ts - (E0 + PERIOD_MS * anchorShift)) / PERIOD_MS);

        if (isNorthAnchor) {
            const nNear = E0 + (k + NORTH_SHIFT) * PERIOD_MS;
            if (nNear <= ts) {
                // Nearest N is in the past: always use current cycle.
                k = kCurrent;
            } else {
                // Nearest N is in the future:
                // if ts is before E of nearest-N cycle -> choose that future cycle,
                // otherwise keep current cycle.
                const eNear = E0 + k * PERIOD_MS;
                k = ts < eNear ? k : kCurrent;
            }
        }

        const start = ms(E0 + k * PERIOD_MS);
        const end = ms(start + PERIOD_MS);
        log('anchors selected', {
            k,
            kCurrent,
            ts: new Date(ts).toISOString(),
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            anchor: anchorShift === NORTH_SHIFT ? 'N' : 'S',
            S: new Date(ms(start + PERIOD_MS * 0.75)).toISOString(),
            N: new Date(ms(start + PERIOD_MS * 0.25)).toISOString(),
        });

        return {
            start,
            end,
            E: start,
            N: ms(start + PERIOD_MS * 0.25),
            W: ms(start + PERIOD_MS * 0.50),
            S: ms(start + PERIOD_MS * 0.75),
            E_next: end,
        };
    }) as Anchors;
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
