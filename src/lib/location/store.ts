// src/lib/location/store.ts
import { writable, get } from 'svelte/store';
import type { Readable } from 'svelte/store';

import { debug } from '../debug';
import type { Location, GeoStatus, LocationData } from './types';

const dbg = debug('location', '📍');

const KEY = 'chrono:location:v1';

export function getSystemTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function now(): number {
    return Date.now();
}

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { return fallback; }
}

function isFiniteNum(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function normalizeLat(lat: number) {
    return Math.max(-90, Math.min(90, lat));
}

function normalizeLon(lon: number) {
    return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function makeId(prefix = 'loc'): string {
    return `${prefix}:${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getGreenwichLocation(): Location {
    return { id: 'loc:greenwich', lat: 0, lon: 0, label: 'Greenwich', tz: 'UTC' };
}

const DEFAULT = getGreenwichLocation();

function sanitizeLocation(x: any, fallbackId = ''): Location | null {
    if (!x || typeof x !== 'object') return null;

    const lat = isFiniteNum(x.lat) ? normalizeLat(x.lat) : null;
    const lon = isFiniteNum(x.lon) ? normalizeLon(x.lon) : null;
    if (lat === null || lon === null) return null;

    const tz = typeof x.tz === 'string' && x.tz.trim()
        ? x.tz.trim()
        : getSystemTimeZone();

    const label = typeof x.label === 'string' ? x.label.trim() : '';
    const id = typeof x.id === 'string' && x.id.trim() ? x.id.trim() : fallbackId;

    return {
        id,
        lat,
        lon,
        label: label || 'New place',
        tz
    };
}

function sanitizeSavedList(x: any): Location[] {
    if (!Array.isArray(x)) return [];

    const out: Location[] = [];
    for (const it of x) {
        const loc = sanitizeLocation(it, '');
        if (!loc) continue;
        if (!loc.id) continue;
        out.push(loc);
    }
    return out;
}

function load(): LocationData {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = safeParse<any>(raw, null);

    const saved = sanitizeSavedList(parsed?.saved);
    const currentId = typeof parsed?.currentId === 'string' ? parsed.currentId.trim() : '';

    return { saved, currentId };
}

function persist(state: LocationData) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
        dbg.warn('persist.fail', err);
    }
}

// ------------------------------------------------------------
// Stores
// ------------------------------------------------------------
const initial: LocationData =
    typeof window !== 'undefined'
        ? load()
        : { saved: [], currentId: '' };

export const locationState = writable<LocationData>(initial);

// keep current id as separate writable for convenience
export const currentLocationId = writable<string>(initial.currentId || '');

export const savedLocations: Readable<Location[]> = {
    subscribe(run) {
        return locationState.subscribe((s) => run(s.saved));
    }
};

export const currentLocation: Readable<Location> = {
    subscribe(run) {
        const unsubA = locationState.subscribe(() => {
            const s = get(locationState);
            const id = get(currentLocationId);
            const hit = s.saved.find((x) => x.id === id) ?? s.saved[0] ?? DEFAULT;
            run(hit);
        });
        const unsubB = currentLocationId.subscribe(() => {
            const s = get(locationState);
            const id = get(currentLocationId);
            const hit = s.saved.find((x) => x.id === id) ?? s.saved[0] ?? DEFAULT;
            run(hit);
        });
        return () => { unsubA(); unsubB(); };
    }
};

export const geoStatus = writable<GeoStatus>('idle');
export const geoError = writable<string>('');

// persistence wiring
if (typeof window !== 'undefined') {
    // persist whenever either saved list or currentId changes
    locationState.subscribe((s) => {
        const id = get(currentLocationId);
        persist({ saved: s.saved, currentId: id });
    });
    currentLocationId.subscribe((id) => {
        const s = get(locationState);
        persist({ saved: s.saved, currentId: id });
    });
}

// ------------------------------------------------------------
// Core helpers
// ------------------------------------------------------------
function sameCoord(a: number, b: number) {
    // enough to treat as same place for UI purposes
    return Math.abs(a - b) < 1e-9;
}

function findMatch(saved: Location[], draft: Pick<Location, 'lat' | 'lon' | 'tz'>): Location | null {
    return saved.find((p) =>
        sameCoord(p.lat, draft.lat) &&
        sameCoord(p.lon, draft.lon) &&
        p.tz === draft.tz
    ) ?? null;
}

/**
 * Upsert по уникальности (lat,lon,tz).
 * - если найден match → обновляет label (если изменился), возвращает id match
 * - если нет → создаёт новую saved-локацию и возвращает новый id
 */
export function upsertSavedLocation(input: Omit<Location, 'id'>, opts?: { setCurrent?: boolean }): string {
    const lat = normalizeLat(input.lat);
    const lon = normalizeLon(input.lon);
    const tz = (input.tz && input.tz.trim()) ? input.tz.trim() : getSystemTimeZone();
    const label = (input.label || 'New place').trim() || 'New place';

    const state = get(locationState);
    const draft = { lat, lon, tz };

    const hit = findMatch(state.saved, draft);
    if (hit) {
        if ((hit.label ?? '') !== label) {
            const updated: Location = { ...hit, label };
            locationState.set({
                saved: [updated, ...state.saved.filter((x) => x.id !== hit.id)],
                currentId: state.currentId
            });
        }
        const id = hit.id;
        if (opts?.setCurrent) currentLocationId.set(id);
        return id;
    }

    const id = makeId('loc');
    const item: Location = { id, lat, lon, tz, label };

    locationState.set({
        saved: [item, ...state.saved],
        currentId: state.currentId
    });

    if (opts?.setCurrent) currentLocationId.set(id);
    return id;
}

export function deleteSavedLocation(id: string) {
    const state = get(locationState);
    const nextSaved = state.saved.filter((p) => p.id !== id);

    locationState.set({
        saved: nextSaved,
        currentId: state.currentId
    });

    // if deleted current -> fallback
    const curId = get(currentLocationId);
    if (curId === id) {
        const next = nextSaved[0];
        if (next) currentLocationId.set(next.id);
        else currentLocationId.set('');
    }
}

/**
 * Резолв по id:
 * - если id не найден → текущая (а если и её нет → DEFAULT)
 */
export function resolveLocationById(id: string | null | undefined): Location {
    const key = (id || '').trim();
    const saved = get(savedLocations);

    if (key) {
        const hit = saved.find((x) => x.id === key);
        if (hit) return hit;
    }

    // fallback to current store-derived location
    return get(currentLocation) ?? DEFAULT;
}

/**
 * Попытаться получить GPS координаты (1 раз).
 * Возвращает LocationDraft (без id) или null.
 */
export async function tryGetGeolocationOnce(): Promise<Omit<Location, 'id'> | null> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        geoStatus.set('unavailable');
        return null;
    }

    geoStatus.set('loading');
    geoError.set('');

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                geoStatus.set('ok');
                resolve({
                    lat: normalizeLat(pos.coords.latitude),
                    lon: normalizeLon(pos.coords.longitude),
                    label: 'Current (GPS)',
                    tz: getSystemTimeZone()
                });
            },
            (err) => {
                geoStatus.set(err?.code === 1 ? 'denied' : 'error');
                geoError.set(err?.message ?? 'Geolocation error');
                resolve(null);
            }
        );
    });
}

/**
 * Инициализация/бутстрап (то, что ты описал).
 *
 * Гарантии после выполнения:
 * - saved.length >= 1
 * - currentLocationId указывает на существующий saved id
 */
export async function initLocation() {
    const state0 = get(locationState);

    // 1) если saved есть — просто валидируем currentId
    if (state0.saved.length > 0) {
        const id = get(currentLocationId) || state0.currentId;
        const hit = state0.saved.find((x) => x.id === id) ?? state0.saved[0];

        locationState.set({ saved: state0.saved, currentId: hit.id });
        currentLocationId.set(hit.id);
        return;
    }

    // 2) saved пуст: пробуем GPS
    const gps = await tryGetGeolocationOnce();

    if (gps) {
        const id = upsertSavedLocation(gps, { setCurrent: true });
        locationState.set({ saved: get(locationState).saved, currentId: id });
        return;
    }

    // 3) GPS не вышло: сохраняем DEFAULT и делаем текущей
    const def = getGreenwichLocation();
    const id = upsertSavedLocation(
        { lat: def.lat, lon: def.lon, label: def.label, tz: def.tz },
        { setCurrent: true }
    );

    locationState.set({ saved: get(locationState).saved, currentId: id });
}
