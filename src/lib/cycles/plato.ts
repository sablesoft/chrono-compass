// src/lib/cycles/plato.ts
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';

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
function normalizeSafe(a: V3, fallback: V3): V3 {
    const n = norm(a);
    return n > 1e-12 ? scale(a, 1 / n) : fallback;
}

// Rodrigues rotation: rotate vector v around axis k (unit) by angle rad
function rotateAroundAxis(v: V3, kUnit: V3, rad: number): V3 {
    const k = kUnit;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    // v_rot = v*c + (k×v)*s + k*(k·v)*(1-c)
    const term1 = scale(v, c);
    const term2 = scale(cross(k, v), s);
    const term3 = scale(k, dot(k, v) * (1 - c));
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

// Project vector v onto plane orthogonal to nUnit
function projectToPlane(v: V3, nUnit: V3): V3 {
    const k = dot(v, nUnit);
    return add(v, scale(nUnit, -k));
}

// Oriented angle between vectors a and b around normal n (right-hand rule)
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
// Constants for the UI model
// -------------------------

// Galactic center (ICRS/J2000) approx
// RA 17h45m40.04s, Dec -29°00'28.1"
const RA_GC = degToRad((17 + 45 / 60 + 40.04 / 3600) * 15); // hours -> degrees
const DEC_GC = degToRad(-(29 + 0 / 60 + 28.1 / 3600));
const G = raDecToUnit(RA_GC, DEC_GC);

// Obliquity of the ecliptic (J2000) ≈ 23.439291°
const EPS = degToRad(23.439291);

// Ecliptic north pole in equatorial (J2000).
// IMPORTANT: sign matters. With standard equatorial axes (+Z=NCP, +X=RA0, +Y=RA90),
// rotating the equatorial pole (0,0,1) by +EPS around +X gives:
// (0, -sin(EPS), cos(EPS))
const ECL_POLE: V3 = normalize({
    x: 0,
    y: -Math.sin(EPS),
    z: Math.cos(EPS),
});

// Precession period (UI approximation)
const MS_PER_YEAR = 365.2422 * 86400_000;
const PRECESSION_YEARS = 25772;
const PERIOD_MS = PRECESSION_YEARS * MS_PER_YEAR;

// J2000 epoch (2000-01-01T12:00:00Z)
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);

// Cone half-angle (obliquity) — for this UI model we reuse EPS
const CONE_HALF_ANGLE = EPS;

// Rate (rad/ms)
const PRECESSION_RAD_PER_MS = (2 * Math.PI) / PERIOD_MS;

// -------------------------
// Earth axis model (simple precession around ecliptic pole)
// -------------------------

// Pick a stable perpendicular axis to ECL_POLE (avoid accidental near-parallel)
function stablePerpTo(n: V3): V3 {
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    // choose basis vector least aligned with n
    const tmp: V3 = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 }
        : ay <= ax && ay <= az ? { x: 0, y: 1, z: 0 }
            : { x: 0, y: 0, z: 1 };
    return normalizeSafe(cross(n, tmp), { x: 1, y: 0, z: 0 });
}

// Build a unit vector P(t): Earth's spin axis in equatorial coords with simple precession
function earthAxisAt(ts: number): V3 {
    const psi = (ts - J2000_MS) * PRECESSION_RAD_PER_MS;

    // Start with a vector tilted by CONE_HALF_ANGLE away from ECL_POLE.
    // Build it deterministically from ECL_POLE + a stable perpendicular.
    const perp = stablePerpTo(ECL_POLE);
    const base = rotateAroundAxis(ECL_POLE, perp, CONE_HALF_ANGLE);

    // Then rotate around ECL_POLE by psi (precession).
    return normalize(rotateAroundAxis(base, ECL_POLE, psi));
}

// -------------------------
// Public API matching your wheel style
// -------------------------

/**
 * "Plato" cycle: precession w.r.t. Galactic Center.
 *
 * Definition:
 * - Work in the ecliptic plane (projection along ECL_POLE).
 * - Phase φ = oriented angle from projected Galactic Center (Gp) to projected Earth axis (Pp)
 *   around +ECL_POLE.
 * - E is φ = 0 (alignment).
 *
 * Anchors are synthetic quarter points in time (like your other wheels):
 * E = start, N = +1/4, W = +1/2, S = +3/4, E_next = +1 cycle.
 */
export function getPlatoAnchors(ts: number): Anchors {
    const phi = getPlatoPhaseRad(ts); // -pi..pi
    // Map φ to u01 in [0,1) where 0 means E (φ=0), increasing with φ.
    const u01 = normalize01(phi / (2 * Math.PI));

    // "start" is nearest previous E: subtract the fraction of the period already elapsed.
    const start = ts - u01 * PERIOD_MS;
    const end = start + PERIOD_MS;

    return {
        start,
        end,
        E: start,
        N: start + PERIOD_MS * 0.25,
        W: start + PERIOD_MS * 0.50,
        S: start + PERIOD_MS * 0.75,
        E_next: end,
    };
}

/**
 * Phase angle (radians) = oriented angle between projected Galactic Center and projected Earth axis,
 * in the ecliptic plane, measured around ecliptic pole.
 * E is φ=0.
 */
export function getPlatoPhaseRad(ts: number) {
    const P = earthAxisAt(ts);

    // project onto ecliptic plane
    const Pproj = projectToPlane(P, ECL_POLE);
    const Gproj = projectToPlane(G, ECL_POLE);

    // Normalize safely (shouldn't be near-zero in normal cases, but let's be robust)
    const Pp = normalizeSafe(Pproj, { x: 1, y: 0, z: 0 });
    const Gp = normalizeSafe(Gproj, { x: 0, y: 1, z: 0 });

    // angle from Gp to Pp around +ECL_POLE
    return orientedAngle(Gp, Pp, ECL_POLE);
}

/**
 * Angle mapping for the wheel: same "cross" mapping as other wheels:
 * E=0, N=-90, W=-180, S=-270, E+=-360.
 */
export const angleFromPlatoAnchors = angleFromAnchors;

/**
 * Shift by ±1 precession cycle (synthetic).
 * IMPORTANT: in your app dir=+1 means "future", and your wheel conventions use
 * forward time = CCW (negative angles). The shift itself is just time.
 */
export function shiftPlatoCycle(cycleStartTs: number, dir: -1 | 1) {
    return cycleStartTs + dir * PERIOD_MS;
}