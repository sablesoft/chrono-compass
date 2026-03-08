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
    const locked = o?.locked ? '1' : '0';
    if (locked === '0') return 'lock=0';
    const loc = String(o?.locationId ?? '');
    return `lock=1&loc=${loc}`;
}

function stableTimeKey(t: WheelTimeState): string {
    const locked = t?.locked ? '1' : '0';
    if (locked === '0') return 'lock=0';

    if (t?.live) {
        return 'lock=1&mode=live';
    }

    const ts = Number(t?.ts);
    return `lock=1&mode=fixed&ts=${Number.isFinite(ts) ? Math.trunc(ts) : 'NaN'}`;
}

function base64Url(raw: string): string {
    return btoa(unescape(encodeURIComponent(raw)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}
