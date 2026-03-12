import { APP_TIME_FRAME_YEARS } from '../settings';

const YEAR_MS = 365.2425 * 86_400_000;

export type WheelTimeframeBounds = {
    minTs?: number;
    maxTs?: number;
};

export function resolveWheelTimeframeBounds(
    timeFrameYears: number | undefined = APP_TIME_FRAME_YEARS,
    baseTs: number = Date.now()
): WheelTimeframeBounds | null {
    if (!Number.isFinite(baseTs) || !Number.isFinite(timeFrameYears)) return null;
    const years = Number(timeFrameYears);
    if (!(years > 0)) return null;
    const deltaMs = years * YEAR_MS;
    return {
        minTs: baseTs - deltaMs,
        maxTs: baseTs + deltaMs,
    };
}

export function clampTsToWheelTimeframe(
    ts: number,
    timeFrameYears: number | undefined = APP_TIME_FRAME_YEARS,
    baseTs: number = Date.now()
): number {
    if (!Number.isFinite(ts)) return ts;
    const bounds = resolveWheelTimeframeBounds(timeFrameYears, baseTs);
    if (!bounds) return ts;
    if (Number.isFinite(bounds.minTs) && ts < (bounds.minTs as number)) return bounds.minTs as number;
    if (Number.isFinite(bounds.maxTs) && ts > (bounds.maxTs as number)) return bounds.maxTs as number;
    return ts;
}

export function isTsWithinWheelTimeframe(
    ts: number,
    timeFrameYears: number | undefined = APP_TIME_FRAME_YEARS,
    baseTs: number = Date.now()
): boolean {
    if (!Number.isFinite(ts)) return false;
    const bounds = resolveWheelTimeframeBounds(timeFrameYears, baseTs);
    if (!bounds) return true;
    if (Number.isFinite(bounds.minTs) && ts < (bounds.minTs as number)) return false;
    if (Number.isFinite(bounds.maxTs) && ts > (bounds.maxTs as number)) return false;
    return true;
}
