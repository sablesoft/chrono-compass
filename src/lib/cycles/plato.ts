// src/lib/cycles/plato.ts
import type { Anchors } from '../wheel/spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { debug } from '../debug';

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
const G = raDecToUnit(RA_GC, DEC_GC);

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

// Cone half-angle (reuse EPS)
const CONE_HALF_ANGLE = EPS;
const PRECESSION_RAD_PER_MS = (2 * Math.PI) / PERIOD_MS;

// GC alignment is SOUTH => φ=0 corresponds to S => +0.75 cycle from E
const SOUTH_SHIFT = 0.75;

// -------------------------
// Earth axis model
// -------------------------
function stablePerpTo(n: V3): V3 {
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const tmp: V3 =
        ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } :
            ay <= ax && ay <= az ? { x: 0, y: 1, z: 0 } :
                { x: 0, y: 0, z: 1 };
    return normalizeSafeDbg(cross(n, tmp), { x: 1, y: 0, z: 0 }, 'cross');
}

function earthAxisAt(ts: number): V3 {
    const psi = (ts - J2000_MS) * PRECESSION_RAD_PER_MS;

    const perp = stablePerpTo(ECL_POLE);
    const base = rotateAroundAxis(ECL_POLE, perp, CONE_HALF_ANGLE);

    return normalize(rotateAroundAxis(base, ECL_POLE, psi));
}

// -------------------------
// Phase
// -------------------------
export function getPlatoPhaseRad(ts: number) {
    ts = ms(ts);

    return group(`phase ts=${new Date(ts).toISOString()}`, () => {
        const P = earthAxisAt(ts);

        const Pproj = projectToPlane(P, ECL_POLE);
        const Gproj = projectToPlane(G, ECL_POLE);

        // здесь чаще всего и "умирает" геометрия (если вектор почти параллелен ECL_POLE)
        const Pp = normalizeSafeDbg(Pproj, { x: 1, y: 0, z: 0 }, 'Pproj');
        const Gp = normalizeSafeDbg(Gproj, { x: 0, y: 1, z: 0 }, 'Gproj');

        const ang = orientedAngle(Gp, Pp, ECL_POLE);

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

// Compute E0: the start of the E-cycle that contains J2000 (or immediately before it)
const phi0 = getPlatoPhaseRad(J2000_MS);
if (!Number.isFinite(phi0)) {
    warn('phi0 is not finite at J2000', { phi0 });
}
// u0 = fraction of cycle elapsed since E at J2000, where φ=0 is SOUTH => shift by 0.75
const u0 = normalize01(phi0 / (2 * Math.PI) + SOUTH_SHIFT);
// nearest previous E relative to J2000:
const E0 = ms(J2000_MS - u0 * PERIOD_MS);
if (!Number.isFinite(E0)) {
    warn('E0 is not finite', { E0, phi0, u0 });
}

export function getPlatoAnchors(ts: number): Anchors {
    ts = ms(ts);

    return group(`anchors ts=${new Date(ts).toISOString()}`, () => {
        const EPS_MS = 1;

        const raw = (ts - E0 + EPS_MS) / PERIOD_MS;
        const k = Math.floor(raw);

        const start = ms(E0 + k * PERIOD_MS);
        const end = ms(start + PERIOD_MS);

        if (!(start <= ts && ts < end)) {
            warn('anchors: ts not inside [start,end)', {
                ts: new Date(ts).toISOString(),
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
                raw,
                k,
            });
        } else {
            log('anchors hit', {
                k,
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
            });
        }

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
