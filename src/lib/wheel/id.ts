// src/lib/wheel/id.ts
import type { WheelType } from '../catalog';
import type { WheelRolesState } from './control';
import type {WheelObserverState, WheelTimeState} from "./types";

function normalizeRoleValue(v: any): string | null {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return v.map(String).sort().join(',');
    return String(v);
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
    // В твоей модели “wheelId = полная конфигурация колеса” — значит locked тоже должен участвовать.
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
    const b64 = btoa(unescape(encodeURIComponent(raw)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
    return b64;
}

/**
 * Детерминированный wheelId = type + roles + observer + time
 */
export function makeWheelId(
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

/**
 * Нормализация time согласно требованиям:
 * - live=true => ts отсутствует
 * - live=false => ts обязателен
 */
export function normalizeWheelTime(input: any, fallbackTs?: number): WheelTimeState {
    const locked = !!input?.locked;

    const live = input?.live === true || input?.live === 'true';
    if (live) return { live: true, locked };

    // fixed
    const ts = Number(input?.ts);
    if (Number.isFinite(ts)) return { live: false, ts: Math.trunc(ts), locked };

    // если нет ts — деградируем в live (или используем fallbackTs если дали)
    if (Number.isFinite(fallbackTs)) return { live: false, ts: Math.trunc(fallbackTs!), locked };
    return { live: true, locked };
}

export function normalizeWheelObserver(input: any, fallbackLocationId: string): WheelObserverState {
    const locationId = (typeof input?.locationId === 'string' && input.locationId.trim().length)
        ? input.locationId.trim()
        : fallbackLocationId;

    return {
        locationId,
        locked: !!input?.locked
    };
}

/**
 * Dedup: оставляет первый по order, но стабилизирует order после.
 */
export function dedupeWheelItemsById<T extends { wheelId: string; order: number }>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];

    for (const it of items) {
        if (!it?.wheelId) continue;
        if (seen.has(it.wheelId)) continue;
        seen.add(it.wheelId);
        out.push(it);
    }

    return out
        .sort((a, b) => a.order - b.order)
        .map((x, i) => ({ ...x, order: i }));
}
