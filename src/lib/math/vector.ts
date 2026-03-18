// src/lib/math/vector.ts

import { AU_KM, AU_PER_LY, deg2rad, isFiniteNumber, norm360 } from "./helpers";
import { isReferenceLikeKind, type ObjKind, type ReferenceMeta, type Vec3 } from "../catalog";

// Obliquity of the ecliptic (J2000), degrees
export const EPS_DEG_J2000 = 23.439291;
export const EPS = deg2rad(EPS_DEG_J2000);

export type Vec = { x: number; y: number; z: number };

export function vectorLengthSafe(v: any): number {
    if (!v) return NaN;

    if (typeof v.Length === 'function') {
        const r = v.Length();
        return isFiniteNumber(r) ? r : NaN;
    }

    if (isFiniteNumber(v.length)) {
        return v.length;
    }

    if (isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z)) {
        const r = Math.hypot(v.x, v.y, v.z);
        return isFiniteNumber(r) ? r : NaN;
    }

    return NaN;
}

export function normalize3(v: Vec3): Vec3 | null {
    const x = v[0], y = v[1], z = v[2];
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null;

    const m2 = x * x + y * y + z * z;
    if (!(m2 > 0)) return null;

    const inv = 1 / Math.sqrt(m2);
    return [x * inv, y * inv, z * inv] as const;
}

// RA/Dec: ra = α, dec = δ
export function unitFromRaDecDeg(raDeg: number, decDeg: number): Vec3 | null {
    if (!isFiniteNumber(raDeg) || !isFiniteNumber(decDeg)) return null;
    if (decDeg < -90 || decDeg > 90) return null;

    const ra = deg2rad(norm360(raDeg));
    const dec = deg2rad(decDeg);

    // стандартные экваториальные сферические координаты
    const cosDec = Math.cos(dec);
    const x = cosDec * Math.cos(ra);
    const y = cosDec * Math.sin(ra);
    const z = Math.sin(dec);

    return normalize3([x, y, z] as const);
}

// lon/lat: lon = λ, lat = β (в соответствующем фрейме)
export function unitFromLonLatDeg(lonDeg: number, latDeg: number): Vec3 | null {
    if (!isFiniteNumber(lonDeg) || !isFiniteNumber(latDeg)) return null;
    if (latDeg < -90 || latDeg > 90) return null;

    const lon = deg2rad(norm360(lonDeg));
    const lat = deg2rad(latDeg);

    const cosLat = Math.cos(lat);
    const x = cosLat * Math.cos(lon);
    const y = cosLat * Math.sin(lon);
    const z = Math.sin(lat);

    return normalize3([x, y, z] as const);
}

// ---------------------------
// public API
// ---------------------------

export function refUnit(meta: ReferenceMeta): Vec3 | null {
    const d = meta?.direction;
    if (!d) return null;

    // 1) Если unit уже задан — только нормализуем и проверяем, что он конечный
    if ('unit' in d && d.unit) {
        return normalize3(d.unit);
    }

    // 2) Иначе — строго по frame + соответствующим полям
    const frame = (d as any).frame as string | undefined;
    if (frame !== 'icrf_j2000' && frame !== 'galactic_iau') return null;

    if (frame === 'icrf_j2000') {
        // В этом фрейме разрешаем ТОЛЬКО raDecDeg (или unit, который уже обработали выше)
        if (!('raDecDeg' in d)) return null;
        if ('lonLatDeg' in d) return null; // строгая защита от “смешения” полей

        const ra = (d as any).raDecDeg?.ra;
        const dec = (d as any).raDecDeg?.dec;
        if (!isFiniteNumber(ra) || !isFiniteNumber(dec)) return null;

        // RA: любые градусы ок → нормализуем в [0..360)
        const raN = norm360(ra);

        // Dec: строго [-90..+90]
        if (dec < -90 || dec > 90) return null;

        return unitFromRaDecDeg(raN, dec);
    }

    if (frame === 'galactic_iau') {
        // В этом фрейме разрешаем ТОЛЬКО lonLatDeg (или unit, который уже обработали выше)
        if (!('lonLatDeg' in d)) return null;
        if ('raDecDeg' in d) return null;

        const lon = (d as any).lonLatDeg?.lon;
        const lat = (d as any).lonLatDeg?.lat;
        if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) return null;

        const lonN = norm360(lon);
        if (lat < -90 || lat > 90) return null;

        return unitFromLonLatDeg(lonN, lat);
    }

    // exhaustiveness (на всякий)
    return null;
}

const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const RAD_TO_DEG = 180 / Math.PI;
const JULIAN_CENTURY_MS = 36525 * 86400_000;
const MAS_TO_RAD = Math.PI / (180 * 3600 * 1000);
const YEAR_MS = 365.25 * 86400_000;
const KM_S_TO_AU_YR = (365.25 * 86400) / AU_KM;

function precessEqJ2000ToDate(u: Vec3, ts: number): Vec3 | null {
    if (!isFiniteNumber(ts)) return u;
    const T = (ts - J2000_UTC_MS) / JULIAN_CENTURY_MS;
    if (!isFiniteNumber(T)) return u;

    // IAU 1976 precession angles (arcsec), good enough for UI-level epoch shift from J2000.
    const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * ARCSEC_TO_RAD;
    const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * ARCSEC_TO_RAD;
    const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * ARCSEC_TO_RAD;

    const ra0 = Math.atan2(u[1], u[0]);
    const dec0 = Math.asin(Math.max(-1, Math.min(1, u[2])));

    const A = Math.cos(dec0) * Math.sin(ra0 + zeta);
    const B = Math.cos(theta) * Math.cos(dec0) * Math.cos(ra0 + zeta) - Math.sin(theta) * Math.sin(dec0);
    const C = Math.sin(theta) * Math.cos(dec0) * Math.cos(ra0 + zeta) + Math.cos(theta) * Math.sin(dec0);

    const ra = Math.atan2(A, B) + z;
    const dec = Math.asin(Math.max(-1, Math.min(1, C)));
    return unitFromRaDecDeg(ra * RAD_TO_DEG, dec * RAD_TO_DEG);
}

function applyStellarMotion(meta: ReferenceMeta, base: Vec3, ts: number): Vec3 | null {
    if (!isFiniteNumber(ts)) return base;
    const dtYears = (ts - J2000_UTC_MS) / YEAR_MS;
    if (!isFiniteNumber(dtYears) || dtYears === 0) return base;

    const pmRaMasYr = Number(meta?.properMotionRaMasYr);
    const pmDecMasYr = Number(meta?.properMotionDecMasYr);
    const rvKmS = Number(meta?.radialVelocityKmS);
    const distPc = Number(meta?.distancePc);

    const hasPmRa = isFiniteNumber(pmRaMasYr) && pmRaMasYr !== 0;
    const hasPmDec = isFiniteNumber(pmDecMasYr) && pmDecMasYr !== 0;
    const hasRv = isFiniteNumber(rvKmS) && rvKmS !== 0 && isFiniteNumber(distPc) && distPc > 0;
    if (!hasPmRa && !hasPmDec && !hasRv) return base;

    const x = base[0];
    const y = base[1];
    const z = base[2];
    const rxy = Math.hypot(x, y);

    // Tangent basis on the celestial sphere at the current reference direction.
    const alphaHat: Vec3 = rxy > 1e-14
        ? (normalize3([-y / rxy, x / rxy, 0] as const) ?? [-y / rxy, x / rxy, 0])
        : [0, 1, 0];
    const deltaHat: Vec3 = normalize3([
        -z * alphaHat[1],
        z * alphaHat[0],
        rxy
    ] as const) ?? [0, 0, 1];

    const muRa = hasPmRa ? (pmRaMasYr * MAS_TO_RAD) : 0;
    const muDec = hasPmDec ? (pmDecMasYr * MAS_TO_RAD) : 0;

    const drdt: Vec3 = [
        muRa * alphaHat[0] + muDec * deltaHat[0],
        muRa * alphaHat[1] + muDec * deltaHat[1],
        muRa * alphaHat[2] + muDec * deltaHat[2]
    ];

    if (!hasRv) {
        return normalize3([
            x + drdt[0] * dtYears,
            y + drdt[1] * dtYears,
            z + drdt[2] * dtYears
        ] as const);
    }

    // 3D propagation: tangential component from proper motion + radial component from RV.
    const distanceAu = distPc * 3.26156 * AU_PER_LY;
    const rvAuYr = rvKmS * KM_S_TO_AU_YR;
    const vx = distanceAu * drdt[0] + rvAuYr * x;
    const vy = distanceAu * drdt[1] + rvAuYr * y;
    const vz = distanceAu * drdt[2] + rvAuYr * z;

    const px = distanceAu * x + vx * dtYears;
    const py = distanceAu * y + vy * dtYears;
    const pz = distanceAu * z + vz * dtYears;
    return normalize3([px, py, pz] as const);
}

export function refUnitAtTsByKind(kind: ObjKind | undefined, meta: ReferenceMeta, ts: number): Vec3 | null {
    const base = refUnit(meta);
    if (!base) return null;
    const moved = isReferenceLikeKind(kind) ? applyStellarMotion(meta, base, ts) : base;
    if (!moved) return null;
    if (!isReferenceLikeKind(kind)) return moved;
    const frame = (meta?.direction as any)?.frame as string | undefined;
    if (frame !== 'icrf_j2000') return moved;
    return precessEqJ2000ToDate(moved, ts);
}

// Rotate vector from equatorial J2000 to ecliptic J2000.
// This is a rotation about +X axis by +ε.
export function eqToEcl(v: Vec): Vec {
    const ce = Math.cos(EPS);
    const se = Math.sin(EPS);

    const x = v.x;
    const y = v.y * ce + v.z * se;
    const z = -v.y * se + v.z * ce;

    return { x, y, z };
}

// Ecliptic longitude (J2000) from a direction vector (in equatorial J2000 input).
export function lonDegEcliptic(uEq: Vec): number {
    const u = eqToEcl(uEq);
    const a = (Math.atan2(u.y, u.x) * 180) / Math.PI;
    return norm360(a);
}
