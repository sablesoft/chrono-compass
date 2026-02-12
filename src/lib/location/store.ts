// src/lib/location/store.ts
import { writable, get } from 'svelte/store';
import { debug } from '../debug';
import type { Location, SavedLocation, GeoStatus, LocationData } from './types';

const dbg = debug('location', '📍');

const KEY = 'chrono:location';

export function getSystemTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

const DEFAULT: Location = {
    lat: 0,
    lon: 0,
    label: 'Greenwich',
    tz: 'UTC'
};

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

const initial =
    typeof window !== 'undefined'
        ? load()
        : { current: DEFAULT, saved: [] };

export const locationState = writable<LocationData>(initial);

export const currentLocation = {
    subscribe: (run: any) =>
        locationState.subscribe(s => run(s.current))
};

export const savedLocations = {
    subscribe: (run: any) =>
        locationState.subscribe(s => run(s.saved))
};

export const geoStatus = writable<GeoStatus>('idle');
export const geoError = writable<string>('');

if (typeof window !== 'undefined') {
    locationState.subscribe((s) => persist(s));
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

    return id;
}

export function deleteSavedLocation(id: string) {
    locationState.update(state => ({
        ...state,
        saved: state.saved.filter(p => p.id !== id)
    }));
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

export function initLocation() {
    const state = get(locationState);

    if (state.saved.length > 0) {
        setLocation(state.saved[0]);
    }
}