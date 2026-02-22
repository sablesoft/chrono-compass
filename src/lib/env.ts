// src/lib/env.ts

type EnvGetter = () => unknown;

/**
 * ⚠️ Vite-специфика:
 * import.meta.env.VITE_FOO — работает
 * import.meta.env[name]    — НЕ работает
 *
 * Поэтому делаем белый список геттеров.
 */
export const ENV = {
    // global
    DEBUG: () => import.meta.env.VITE_DEBUG,

    // debug channels
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
    CYCLE_IDB: () => import.meta.env.VITE_CYCLE_IDB,
} as const satisfies Record<string, EnvGetter>;

export type EnvKey = keyof typeof ENV;

function getRaw(key: EnvKey): unknown {
    return ENV[key]();
}

function truthy(v: unknown): boolean {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/**
 * Если переменной нет (undefined) — возвращаем fallback.
 * Если есть, но пустая строка — false.
 */
export function envBool(key: EnvKey, fallback: boolean): boolean {
    const raw = getRaw(key);
    if (raw === undefined) return fallback;

    const s = String(raw).trim();
    if (!s.length) return false;

    return truthy(s);
}

export function envStr(key: EnvKey, fallback: string): string {
    const raw = getRaw(key);
    if (raw === undefined) return fallback;
    const s = String(raw);
    return s.length ? s : fallback;
}

export function envNum(key: EnvKey, fallback: number): number {
    const raw = getRaw(key);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
