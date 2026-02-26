// src/lib/profile/dedup.ts
import type {WheelType} from '../catalog';
import type {WheelRolesState} from '../wheel/control';
import type {WheelObserverState, WheelTimeState} from "../wheel/types";

export function normalizeRoleValue(v: any): string | null {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return v.map(String).sort().join(',');
    return String(v);
}

/**
 * Детерминированный dedupKey = type + roles + observer + time
 */
export function makeDedupKey(
    type: WheelType,
    roles: WheelRolesState,
    observer: WheelObserverState,
    time: WheelTimeState
): string {
    const rolesKey = stableRolesKey(roles);
    const obsKey = stableObserverKey(observer);
    const timeKey = stableTimeKey(time);

    const raw = `${type}::${rolesKey}::${obsKey}::${timeKey}`;
    return `wheel:${type}:${base64Url(raw)}`;
}

function stableRolesKey(roles: WheelRolesState): string {
    const entries = Object.entries(roles ?? {})
        .map(([k, v]) => [k, normalizeRoleValue(v)] as const)
        .filter(([, v]) => v !== null);

    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

function stableObserverKey(o: WheelObserverState): string {
    // locationId обязателен, locked влияет на поведение, но НЕ на астрономию.
    // В твоей модели “dedupKey = полная конфигурация колеса” — значит locked тоже должен участвовать.
    // Если позже решишь, что lock не часть “сущности”, его можно убрать из id.
    const loc = String(o?.locationId ?? '');
    const locked = o?.locked ? '1' : '0';
    return `loc=${loc}&lock=${locked}`;
}

function stableTimeKey(t: WheelTimeState): string {
    const locked = t?.locked ? '1' : '0';

    if (t?.live) {
        return `mode=live&lock=${locked}`;
    }

    // fixed
    const ts = Number(t?.ts);
    return `mode=fixed&ts=${Number.isFinite(ts) ? Math.trunc(ts) : 'NaN'}&lock=${locked}`;
}

function base64Url(raw: string): string {
    return btoa(unescape(encodeURIComponent(raw)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}
