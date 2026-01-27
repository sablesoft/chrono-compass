// src/lib/stores/location.ts
import { writable, get } from 'svelte/store';
import type { CurrentLocation } from '../types';

/**
 * Expected shape of CurrentLocation in ../types:
 * {
 *   lat: number;
 *   lon: number;
 *   label: string;
 * }
 *
 * (We keep your lat/lon naming to avoid rippling changes across the app.)
 */

export type SavedLocation = {
    id: string;
    label: string;
    lat: number;
    lon: number;
};

const LS_KEY_CURRENT = 'timewheels.location.current.v1';
const LS_KEY_SAVED = 'timewheels.location.saved.v1';

const DEFAULT: CurrentLocation = {
    lat: -23.22,
    lon: -44.72,
    label: 'Paraty (manual)',
};

function isFiniteNum(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function normalizeLat(lat: number) {
    return Math.max(-90, Math.min(90, lat));
}

function normalizeLon(lon: number) {
    // normalize to [-180..180)
    return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function sanitizeCurrent(x: any): CurrentLocation | null {
    if (!x || typeof x !== 'object') return null;
    const lat = isFiniteNum(x.lat) ? normalizeLat(x.lat) : null;
    const lon = isFiniteNum(x.lon) ? normalizeLon(x.lon) : null;
    const label = typeof x.label === 'string' ? x.label.trim() : '';
    if (lat === null || lon === null) return null;
    return { lat, lon, label: label || 'New place' };
}

function sanitizeSavedList(x: any): SavedLocation[] {
    if (!Array.isArray(x)) return [];
    const out: SavedLocation[] = [];
    for (const it of x) {
        if (!it || typeof it !== 'object') continue;
        const id = typeof it.id === 'string' ? it.id : '';
        const label = typeof it.label === 'string' ? it.label.trim() : '';
        const lat = isFiniteNum(it.lat) ? normalizeLat(it.lat) : null;
        const lon = isFiniteNum(it.lon) ? normalizeLon(it.lon) : null;
        if (!id || lat === null || lon === null) continue;
        out.push({ id, label: label || 'Saved place', lat, lon });
    }
    return out;
}

function loadCurrentFromLS(): CurrentLocation {
    try {
        const raw = localStorage.getItem(LS_KEY_CURRENT);
        if (!raw) return DEFAULT;
        const parsed = JSON.parse(raw);
        return sanitizeCurrent(parsed) ?? DEFAULT;
    } catch {
        return DEFAULT;
    }
}

function loadSavedFromLS(): SavedLocation[] {
    try {
        const raw = localStorage.getItem(LS_KEY_SAVED);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return sanitizeSavedList(parsed);
    } catch {
        return [];
    }
}

function persistCurrent(loc: CurrentLocation) {
    try {
        localStorage.setItem(LS_KEY_CURRENT, JSON.stringify(loc));
    } catch {
        // ignore
    }
}

function persistSaved(list: SavedLocation[]) {
    try {
        localStorage.setItem(LS_KEY_SAVED, JSON.stringify(list));
    } catch {
        // ignore
    }
}

function makeId() {
    // good enough for local UI
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const currentLocation = writable<CurrentLocation>(
    typeof window !== 'undefined' ? loadCurrentFromLS() : DEFAULT
);

export const savedLocations = writable<SavedLocation[]>(
    typeof window !== 'undefined' ? loadSavedFromLS() : []
);

// persist on changes
if (typeof window !== 'undefined') {
    currentLocation.subscribe((v) => persistCurrent(v));
    savedLocations.subscribe((v) => persistSaved(v));
}

// -------- public API used by LocationPicker --------

export function setCurrentLocation(loc: CurrentLocation) {
    const s = sanitizeCurrent(loc) ?? DEFAULT;
    currentLocation.set(s);
}

export function saveCurrentLocation(loc?: CurrentLocation) {
    const cur = sanitizeCurrent(loc ?? get(currentLocation));
    if (!cur) return;

    const list = get(savedLocations);

    // if same coords already exist -> update label + move to top
    const hitIdx = list.findIndex(
        (p) => Math.abs(p.lat - cur.lat) < 1e-9 && Math.abs(p.lon - cur.lon) < 1e-9
    );

    const item: SavedLocation = {
        id: hitIdx >= 0 ? list[hitIdx].id : makeId(),
        label: cur.label,
        lat: cur.lat,
        lon: cur.lon,
    };

    const next =
        hitIdx >= 0
            ? [item, ...list.filter((_, i) => i !== hitIdx)]
            : [item, ...list];

    savedLocations.set(next);
}

export function deleteSavedLocation(id: string) {
    if (!id) return;
    const list = get(savedLocations);
    const next = list.filter((p) => p.id !== id);
    savedLocations.set(next);
}

export function createEmptyIfNone() {
    const list = get(savedLocations);
    if (list.length) return;

    const cur = get(currentLocation);
    const item: SavedLocation = {
        id: makeId(),
        label: cur.label || 'Paraty (manual)',
        lat: cur.lat,
        lon: cur.lon,
    };
    savedLocations.set([item]);
}
