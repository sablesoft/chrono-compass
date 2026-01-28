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
const DEFAULT: CurrentLocation = { lat: 0, lon: 0, label: 'Greenwich' };

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
    // currentLocation.subscribe((v) => persistCurrent(v));
    savedLocations.subscribe((v) => persistSaved(v));
}

// -------- public API used by LocationPicker --------

export function setCurrentLocation(loc: CurrentLocation) {
    // по умолчанию считаем "пользовательским" действием => персистим
    setCurrentLocationPersistent(loc);
}

function setCurrentLocationInternal(loc: CurrentLocation) {
    const s = sanitizeCurrent(loc) ?? DEFAULT;
    currentLocation.set(s);
}

export function setCurrentLocationPersistent(loc: CurrentLocation) {
    const s = sanitizeCurrent(loc) ?? DEFAULT;
    currentLocation.set(s);
    if (typeof window !== 'undefined') persistCurrent(s);
}

export function setCurrentLocationTransient(loc: CurrentLocation) {
    // ставим в store, но НЕ пишем в localStorage
    setCurrentLocationInternal(loc);
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
        label: cur.label || 'Your location name...',
        lat: cur.lat,
        lon: cur.lon,
    };
    savedLocations.set([item]);
}

// ---- Geolocation (temporary current, not saved) ----

export type GeoStatus = 'idle' | 'loading' | 'ok' | 'denied' | 'unavailable' | 'error';

export const geoStatus = writable<GeoStatus>('idle');
export const geoError = writable<string>('');

// одноразово: попытаться поставить currentLocation из GPS, НЕ сохраняя
export async function trySetGeolocationAsCurrentOnce(opts?: {
    timeoutMs?: number;
    maximumAgeMs?: number;
    highAccuracy?: boolean;
}) {
    if (typeof window === 'undefined') return;

    if (!('geolocation' in navigator)) {
        geoStatus.set('unavailable');
        return;
    }

    geoStatus.set('loading');
    geoError.set('');

    const timeout = opts?.timeoutMs ?? 8000;
    const maximumAge = opts?.maximumAgeMs ?? 60_000;
    const enableHighAccuracy = opts?.highAccuracy ?? false;

    return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = normalizeLat(pos.coords.latitude);
                const lon = normalizeLon(pos.coords.longitude);

                // ВАЖНО: только currentLocation — никаких saveCurrentLocation()
                setCurrentLocation({
                    lat,
                    lon,
                    label: 'Current (GPS)',
                });

                geoStatus.set('ok');
                resolve();
            },
            (err) => {
                // 1 = denied, 2 = unavailable, 3 = timeout
                if (err?.code === 1) geoStatus.set('denied');
                else if (err?.code === 2) geoStatus.set('unavailable');
                else geoStatus.set('error');

                geoError.set(err?.message ?? 'Geolocation error');
                resolve();
            },
            { enableHighAccuracy, timeout, maximumAge }
        );
    });
}

function epsEq(a: number, b: number, eps = 1e-9) {
    return Math.abs(a - b) < eps;
}

function findSavedByCoords(list: SavedLocation[], cur: CurrentLocation) {
    return list.find(p => epsEq(p.lat, cur.lat) && epsEq(p.lon, cur.lon));
}

async function tryGetGeolocation(opts?: {
    timeoutMs?: number;
    maximumAgeMs?: number;
    highAccuracy?: boolean;
}): Promise<CurrentLocation | null> {
    if (typeof window === 'undefined') return null;
    if (!('geolocation' in navigator)) return null;

    const timeout = opts?.timeoutMs ?? 8000;
    const maximumAge = opts?.maximumAgeMs ?? 60_000;
    const enableHighAccuracy = opts?.highAccuracy ?? false;

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: normalizeLat(pos.coords.latitude),
                    lon: normalizeLon(pos.coords.longitude),
                    label: 'Current (GPS)',
                });
            },
            () => resolve(null),
            { enableHighAccuracy, timeout, maximumAge }
        );
    });
}

// Вызывай один раз на старте приложения (onMount)
export async function initLocation() {
    if (typeof window === 'undefined') return;

    const saved = get(savedLocations);

    // 1) Если есть сохранённые — current = текущий сохранённый, иначе первый сохранённый
    if (saved.length > 0) {
        const lsCur = loadCurrentFromLS(); // твоя функция уже есть
        const hit = findSavedByCoords(saved, lsCur);
        const pick = hit ?? saved[0];

        const cur: CurrentLocation = { lat: pick.lat, lon: pick.lon, label: pick.label };

        // это “сохранённый профиль”, значит фиксируем его как current в LS
        setCurrentLocationPersistent(cur);
        return;
    }

    // 2) Если сохранённых нет — НЕ используем LS current вообще.
    //    Пробуем GPS без сохранения
    const gps = await tryGetGeolocation({ timeoutMs: 8000, maximumAgeMs: 60_000, highAccuracy: false });
    if (gps) {
        setCurrentLocationTransient(gps); // важно: без localStorage
        return;
    }

    // 3) Если GPS не получилось — Greenwich fallback (тоже без localStorage, чтобы на след. запуск снова пробовать GPS)
    setCurrentLocationTransient(DEFAULT);
}