// src/lib/env.ts

export type EnvGetter = () => any;

function truthy(v: any): boolean {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

function toNumber(v: any): number | null {
    if (v == null) return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
}

function toString(v: any): string | null {
    if (v == null) return null;
    const s = String(v);
    return s.length ? s : null;
}

// Реестр всех env, которые реально используешь.
// Да, это “явный список”. Это цена Vite.
const ENV: Record<string, EnvGetter> = {
    // debug
    DEBUG: () => import.meta.env.VITE_DEBUG,
    DEBUG_APP: () => import.meta.env.VITE_DEBUG_APP,
    DEBUG_LOCATION: () => import.meta.env.VITE_DEBUG_LOCATION,
    DEBUG_COMPASS: () => import.meta.env.VITE_DEBUG_COMPASS,
    DEBUG_PROFILE: () => import.meta.env.VITE_DEBUG_PROFILE,
    DEBUG_CONTROL: () => import.meta.env.VITE_DEBUG_CONTROL,
    DEBUG_BOARD: () => import.meta.env.VITE_DEBUG_BOARD,
    DEBUG_WHEEL: () => import.meta.env.VITE_DEBUG_WHEEL,
    DEBUG_CYCLE: () => import.meta.env.VITE_DEBUG_CYCLE,
    DEBUG_DIURNAL: () => import.meta.env.VITE_DEBUG_DIURNAL,
    DEBUG_LUNAR_SYNODIC: () => import.meta.env.VITE_DEBUG_LUNAR_SYNODIC,
    DEBUG_LUNAR_DRACONIC: () => import.meta.env.VITE_DEBUG_LUNAR_DRACONIC,
    DEBUG_LUNAR_ANOMALISTIC: () => import.meta.env.VITE_DEBUG_LUNAR_ANOMALISTIC,
    DEBUG_SOLAR_TROPICAL: () => import.meta.env.VITE_DEBUG_SOLAR_TROPICAL,
    DEBUG_SOLAR_ANOMALISTIC: () => import.meta.env.VITE_DEBUG_SOLAR_ANOMALISTIC,
    DEBUG_PLATO: () => import.meta.env.VITE_DEBUG_PLATO,

    // features
    CYCLE_IDB: () => import.meta.env.VITE_CYCLE_IDB, // <- добавим в .env
};

function getRaw(key: string): any {
    const g = ENV[key];
    return g ? g() : undefined;
}

// Публичные хелперы
export function envBool(key: string, fallback: boolean): boolean {
    const raw = getRaw(key);

    // переменной вообще нет
    if (raw === undefined) return fallback;

    // есть, но пустая/нулевая
    if (raw == null) return false;

    const s = String(raw).trim().toLowerCase();

    if (!s.length) return false;

    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

export function envNum(key: string, fallback: number): number {
    const v = toNumber(getRaw(key));
    return v == null ? fallback : v;
}

export function envStr(key: string, fallback: string): string {
    const v = toString(getRaw(key));
    return v == null ? fallback : v;
}

// Иногда удобно для логов/диагностики
export function envHas(key: string): boolean {
    return getRaw(key) !== undefined;
}
