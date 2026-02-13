// src/lib/location/store.ts
import { writable, get } from 'svelte/store';
import { debug } from '../debug';
import type { Location, SavedLocation, GeoStatus, LocationData } from './types';
import type { Readable } from 'svelte/store';

export const GLOBAL_CUSTOM_LOCATION_ID = 'loc:custom';

/**
 * Глобальный "id выбранной локации".
 * - savedId -> id в savedLocations
 * - loc:custom -> текущий currentLocation (набрали руками / несохранённое)
 */
export const currentLocationId = writable<string>(GLOBAL_CUSTOM_LOCATION_ID);

const dbg = debug('location', '📍');

const KEY = 'chrono:location';
const KEY_ID = 'chrono:location:id';

export function getSystemTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

export function getGreenwichLocation(): Location {
    return { lat: 0, lon: 0, label: 'Greenwich', tz: 'UTC' };
}

const DEFAULT: Location = getGreenwichLocation();

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

function sanitizeLocation(x: any): Location | null {
    if (!x || typeof x !== 'object') return null;

    const lat = isFiniteNum(x.lat) ? normalizeLat(x.lat) : null;
    const lon = isFiniteNum(x.lon) ? normalizeLon(x.lon) : null;
    if (lat === null || lon === null) return null;

    const label = typeof x.label === 'string' ? x.label.trim() : '';
    const tz = typeof x.tz === 'string' && x.tz.trim()
        ? x.tz.trim()
        : getSystemTimeZone();

    return {
        lat,
        lon,
        label: label || 'New place',
        tz
    };
}

function sanitizeSavedList(x: any): SavedLocation[] {
    if (!Array.isArray(x)) return [];

    const out: SavedLocation[] = [];

    for (const it of x) {
        const loc = sanitizeLocation(it);
        if (!loc) continue;

        const id = typeof it.id === 'string' ? it.id : '';
        if (!id) continue;

        const createdAt = typeof it.createdAt === 'number' ? it.createdAt : now();
        const updatedAt = typeof it.updatedAt === 'number' ? it.updatedAt : createdAt;

        out.push({
            ...loc,
            id,
            createdAt,
            updatedAt
        });
    }

    return out;
}

function persist(data: LocationData) {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
        dbg.warn('persist.fail', err);
    }
}

function load(): LocationData {
    const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(KEY)
        : null;

    const parsed = safeParse<any>(raw, null);

    const current = sanitizeLocation(parsed?.current) ?? DEFAULT;
    const saved = sanitizeSavedList(parsed?.saved);

    return { current, saved };
}

function loadId(): string {
    try {
        const v = localStorage.getItem(KEY_ID);
        return (v && v.trim()) ? v.trim() : GLOBAL_CUSTOM_LOCATION_ID;
    } catch {
        return GLOBAL_CUSTOM_LOCATION_ID;
    }
}

function persistId(id: string) {
    try {
        localStorage.setItem(KEY_ID, id);
    } catch {
        // ignore
    }
}

const initial =
    typeof window !== 'undefined'
        ? load()
        : { current: DEFAULT, saved: [] };

export const locationState = writable<LocationData>(initial);

export const currentLocation: Readable<Location> = {
    subscribe(run) {
        return locationState.subscribe((s: LocationData) => run(s.current));
    }
};

export const savedLocations: Readable<SavedLocation[]> = {
    subscribe(run) {
        return locationState.subscribe((s: LocationData) => run(s.saved));
    }
};

export const geoStatus = writable<GeoStatus>('idle');
export const geoError = writable<string>('');

/**
 * Резолвим Location по locationId.
 * - savedId -> savedLocations[id]
 * - loc:custom -> currentLocation
 * - loc:system -> currentLocation
 */
export function resolveLocationById(locationId: string | null | undefined): Location {
    const id = (locationId || '').trim();

    if (!id || id === GLOBAL_CUSTOM_LOCATION_ID || id === 'loc:system') {
        return get(currentLocation);
    }

    const hit = get(savedLocations).find((x: SavedLocation) => x.id === id);
    return hit ? { lat: hit.lat, lon: hit.lon, label: hit.label, tz: hit.tz } : get(currentLocation);
}

/**
 * Когда глобальный пикер выбирает локацию — он должен выставлять и currentLocation, и currentLocationId.
 * Вызывай это из Header/глобального LocationPicker onChange.
 */
export function setGlobalLocation(loc: Location, meta?: { savedId?: string | null }) {
    setLocation(loc);
    currentLocationId.set(meta?.savedId ? meta.savedId : GLOBAL_CUSTOM_LOCATION_ID);
}

/* =======================
   Persistence wiring
   ======================= */

if (typeof window !== 'undefined') {
    // 1) поднимаем last chosen id сразу при старте
    currentLocationId.set(loadId());

    // 2) сохраняем state (current + saved)
    locationState.subscribe((s) => persist(s));

    // 3) сохраняем id выбора отдельно (иначе после reload всегда loc:custom)
    currentLocationId.subscribe((id) => persistId(id));
}

/* =======================
   Public API
   ======================= */

export function setLocation(loc: Location) {
    const s = sanitizeLocation(loc) ?? DEFAULT;

    locationState.update(state => ({
        ...state,
        current: s
    }));
}

/**
 * Гарантируем: в saved всегда есть хотя бы 1 локация.
 * Возвращает id первой/созданной.
 */
export function ensureAtLeastOneSavedLocation(fallback?: Location): string {
    const state = get(locationState);
    if (state.saved.length > 0) return state.saved[0].id;

    const base = sanitizeLocation(fallback ?? state.current) ?? DEFAULT;

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const t = now();

    const item: SavedLocation = {
        ...base,
        id,
        createdAt: t,
        updatedAt: t
    };

    locationState.set({
        current: base,
        saved: [item]
    });

    currentLocationId.set(id);

    return id;
}

export function saveLocation(loc?: Location): string | null {
    const cur = sanitizeLocation(loc ?? get(locationState).current);
    if (!cur) return null;

    const state = get(locationState);

    const hitIdx = state.saved.findIndex(
        p => Math.abs(p.lat - cur.lat) < 1e-9 &&
            Math.abs(p.lon - cur.lon) < 1e-9
    );

    const id = hitIdx >= 0
        ? state.saved[hitIdx].id
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    const nowTs = now();
    const prev = hitIdx >= 0 ? state.saved[hitIdx] : null;

    const item: SavedLocation = {
        ...cur,
        id,
        createdAt: prev?.createdAt ?? nowTs,
        updatedAt: nowTs
    };

    const nextSaved =
        hitIdx >= 0
            ? [item, ...state.saved.filter((_, i) => i !== hitIdx)]
            : [item, ...state.saved];

    locationState.set({
        current: cur,
        saved: nextSaved
    });

    currentLocationId.set(id);

    return id;
}

export function deleteSavedLocation(id: string) {
    locationState.update(state => ({
        ...state,
        saved: state.saved.filter(p => p.id !== id)
    }));

    // если удалили выбранную saved-локацию — мягко откатимся
    const curId = get(currentLocationId);
    if (curId === id) {
        const s = get(locationState);
        const next = s.saved[0];
        if (next) {
            setLocation(next);
            currentLocationId.set(next.id);
        } else {
            currentLocationId.set(GLOBAL_CUSTOM_LOCATION_ID);
        }
    }
}

export async function trySetGeolocationAsCurrentOnce() {
    if (!('geolocation' in navigator)) {
        geoStatus.set('unavailable');
        return;
    }

    geoStatus.set('loading');
    geoError.set('');

    return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: normalizeLat(pos.coords.latitude),
                    lon: normalizeLon(pos.coords.longitude),
                    label: 'Current (GPS)',
                    tz: getSystemTimeZone()
                });

                // GPS — это “custom”, если не делали Save()
                currentLocationId.set(GLOBAL_CUSTOM_LOCATION_ID);

                geoStatus.set('ok');
                resolve();
            },
            (err) => {
                geoStatus.set('error');
                geoError.set(err?.message ?? 'Geolocation error');
                resolve();
            }
        );
    });
}

/**
 * Можно вызывать при старте приложения.
 * Делаем так, чтобы:
 * - если currentLocationId указывает на saved — используем её
 * - иначе если есть saved — используем первую
 * - иначе создаём saved из current/DEFAULT
 */
export function initLocation() {
    const state = get(locationState);
    const id = get(currentLocationId);

    // 1) если id указывает на saved — берём его
    const hit = state.saved.find((x) => x.id === id);
    if (hit) {
        setLocation(hit);
        currentLocationId.set(hit.id);
        return;
    }

    // 2) иначе если есть saved — берём первую
    if (state.saved.length > 0) {
        setLocation(state.saved[0]);
        currentLocationId.set(state.saved[0].id);
        return;
    }

    // 3) иначе создаём fallback saved и берём её
    const newId = ensureAtLeastOneSavedLocation(state.current ?? DEFAULT);
    const s2 = get(locationState);
    const first = s2.saved.find((x) => x.id === newId) ?? s2.saved[0];
    if (first) setLocation(first);
}
