// src/lib/math/helpers.ts

export const DAY_MS = 86_400_000;

export const AU_KM = 149_597_870.7;

export function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

export function lerp(a: number, b: number, u01: number) {
    return a + (b - a) * u01;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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

export function deg2rad(d: number): number {
    return (d * Math.PI) / 180;
}

export function formatCycleDurationTag(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    let leftMin = Math.round(ms / 60_000);
    const MIN_PER_HOUR = 60;
    const MIN_PER_DAY = 24 * MIN_PER_HOUR;
    const MIN_PER_MONTH = 30 * MIN_PER_DAY;
    const MIN_PER_YEAR = 365 * MIN_PER_DAY;

    const year = Math.floor(leftMin / MIN_PER_YEAR); leftMin -= year * MIN_PER_YEAR;
    const month = Math.floor(leftMin / MIN_PER_MONTH); leftMin -= month * MIN_PER_MONTH;
    const day = Math.floor(leftMin / MIN_PER_DAY); leftMin -= day * MIN_PER_DAY;
    const hour = Math.floor(leftMin / MIN_PER_HOUR); leftMin -= hour * MIN_PER_HOUR;
    const min = leftMin;

    const parts: string[] = [];
    if (year) parts.push(`${year}y`);
    if (month) parts.push(`${month}mo`);
    if (day) parts.push(`${day}d`);
    if (hour) parts.push(`${hour}h`);
    if (min || parts.length === 0) parts.push(`${min}m`);
    return `cycle duration ${parts.join(' ')}`;
}
