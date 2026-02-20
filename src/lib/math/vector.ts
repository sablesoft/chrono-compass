// src/lib/math/vector.ts

import {deg2rad, isFiniteNumber, norm360} from "./helpers";
import type {ReferenceMeta, Vec3} from "../catalog";


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
        const u = normalize3(d.unit);
        return u;
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
