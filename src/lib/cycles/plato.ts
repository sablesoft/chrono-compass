// src/lib/cycles/plato.ts
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import {ms} from "../format";

type V3 = { x: number; y: number; z: number };

function dot(a: V3, b: V3) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function cross(a: V3, b: V3): V3 {
    return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x };
}
function add(a: V3, b: V3): V3 { return { x: a.x+b.x, y: a.y+b.y, z: a.z+b.z }; }
function scale(a: V3, k: number): V3 { return { x: a.x*k, y: a.y*k, z: a.z*k }; }
function norm(a: V3) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a: V3): V3 {
    const n = norm(a);
    return n > 0 ? scale(a, 1/n) : { x: 0, y: 0, z: 0 };
}
function normalizeSafe(a: V3, fallback: V3): V3 {
    const n = norm(a);
    return n > 1e-12 ? scale(a, 1/n) : fallback;
}
function rotateAroundAxis(v: V3, kUnit: V3, rad: number): V3 {
    const c = Math.cos(rad), s = Math.sin(rad);
    const term1 = scale(v, c);
    const term2 = scale(cross(kUnit, v), s);
    const term3 = scale(kUnit, dot(kUnit, v) * (1 - c));
    return add(add(term1, term2), term3);
}
function degToRad(d: number) { return (d * Math.PI) / 180; }

function raDecToUnit(raRad: number, decRad: number): V3 {
    const c = Math.cos(decRad);
    return normalize({ x: c*Math.cos(raRad), y: c*Math.sin(raRad), z: Math.sin(decRad) });
}
function projectToPlane(v: V3, nUnit: V3): V3 {
    const k = dot(v, nUnit);
    return add(v, scale(nUnit, -k));
}
function orientedAngle(a: V3, b: V3, nUnit: V3) {
    const axb = cross(a, b);
    return Math.atan2(dot(nUnit, axb), dot(a, b));
}
function normalize01(x: number) {
    let t = x % 1;
    if (t < 0) t += 1;
    return t;
}
// --- constants

const RA_GC  = degToRad((17 + 45/60 + 40.04/3600) * 15);
const DEC_GC = degToRad(-(29 + 0/60 + 28.1/3600));
const G = raDecToUnit(RA_GC, DEC_GC);

const EPS = degToRad(23.439291);
const ECL_POLE: V3 = normalize({ x: 0, y: -Math.sin(EPS), z: Math.cos(EPS) });

const MS_PER_YEAR = 365.2422 * 86400_000;

// ВАЖНО: делаем период строго целым количеством миллисекунд
const PRECESSION_YEARS = 25772;
const PERIOD_MS = ms(PRECESSION_YEARS * MS_PER_YEAR);

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
const CONE_HALF_ANGLE = EPS;
const PRECESSION_RAD_PER_MS = (2 * Math.PI) / PERIOD_MS;

function stablePerpTo(n: V3): V3 {
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const tmp: V3 =
        ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } :
            ay <= ax && ay <= az ? { x: 0, y: 1, z: 0 } :
                { x: 0, y: 0, z: 1 };
    return normalizeSafe(cross(n, tmp), { x: 1, y: 0, z: 0 });
}

function earthAxisAt(ts: number): V3 {
    const psi = (ts - J2000_MS) * PRECESSION_RAD_PER_MS;

    const perp = stablePerpTo(ECL_POLE);
    const base = rotateAroundAxis(ECL_POLE, perp, CONE_HALF_ANGLE);
    return normalize(rotateAroundAxis(base, ECL_POLE, psi));
}

// φ=0 соответствует SOUTH => сдвиг +0.75 цикла
export function getPlatoAnchors(ts: number): Anchors {
    const phi = getPlatoPhaseRad(ts);
    const u01 = normalize01(phi / (2 * Math.PI) + 0.75);

    const start = ms(ts - u01 * PERIOD_MS);
    const end = ms(start + PERIOD_MS);

    return {
        start,
        end,
        E: start,
        N: ms(start + PERIOD_MS * 0.25),
        W: ms(start + PERIOD_MS * 0.50),
        S: ms(start + PERIOD_MS * 0.75),
        E_next: end,
    };
}

export function getPlatoPhaseRad(ts: number) {
    const P = earthAxisAt(ts);
    const Pproj = projectToPlane(P, ECL_POLE);
    const Gproj = projectToPlane(G, ECL_POLE);

    const Pp = normalizeSafe(Pproj, { x: 1, y: 0, z: 0 });
    const Gp = normalizeSafe(Gproj, { x: 0, y: 1, z: 0 });

    return orientedAngle(Gp, Pp, ECL_POLE);
}

export const angleFromPlatoAnchors = angleFromAnchors;

export function shiftPlatoCycle(cycleStartTs: number, dir: -1 | 1) {
    return ms(ms(cycleStartTs) + dir * PERIOD_MS);
}