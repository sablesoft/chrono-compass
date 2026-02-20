// src/lib/math/helpers.ts

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export const AU_KM = 149_597_870.7;

export function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

export function lerp(a: number, b: number, u01: number) {
    return a + (b - a) * u01;
}

export function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

export function norm360(deg: number): number {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

export function toSigned180(deg0_360: number): number {
    let a = norm360(deg0_360);
    if (a > 180) a -= 360;
    return a;
}
