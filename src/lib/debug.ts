// src/lib/debug.ts
export type DebugApi = {
    enabled: boolean;
    group<T>(title: string, fn: () => T): T;
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
};

function camelToSnakeUpper(s: string): string {
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();
}

function truthy(v: any): boolean {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/**
 * ⚠️ Vite-специфика:
 * import.meta.env.VITE_FOO — работает
 * import.meta.env[name]    — НЕ работает
 *
 * Поэтому все каналы объявляем явно.
 */
const KNOWN_CHANNELS: Record<string, () => any> = {
    // app / layout
    APP: () => import.meta.env.VITE_DEBUG_APP,

    // wheel / ui
    COMPASS: () => import.meta.env.VITE_DEBUG_COMPASS,
    WHEEL: () => import.meta.env.VITE_DEBUG_WHEEL,
    DIURNAL: () => import.meta.env.VITE_DEBUG_DIURNAL,

    // lunar
    LUNAR_SYNODIC: () => import.meta.env.VITE_DEBUG_LUNAR_SYNODIC,
    LUNAR_DRACONIC: () => import.meta.env.VITE_DEBUG_LUNAR_DRACONIC,
    LUNAR_ANOMALISTIC: () => import.meta.env.VITE_DEBUG_LUNAR_ANOMALISTIC,

    // solar
    SOLAR_TROPICAL: () => import.meta.env.VITE_DEBUG_SOLAR_TROPICAL,
    SOLAR_ANOMALISTIC: () => import.meta.env.VITE_DEBUG_SOLAR_ANOMALISTIC,

    // long cycles
    PLATO: () => import.meta.env.VITE_DEBUG_PLATO,
};

function isEnabled(channel: string): boolean {
    // глобальный флаг
    const all = truthy(import.meta.env.VITE_DEBUG);

    // канальный флаг
    const key = camelToSnakeUpper(channel);
    const getter = KNOWN_CHANNELS[key];
    const per = getter ? truthy(getter()) : false;

    return all || per;
}

export function debug(channel: string, icon = '🐞'): DebugApi {
    // вычисляется один раз при загрузке модуля
    const enabled = isEnabled(channel);
    const prefix = `[${channel}]`;

    function group<T>(title: string, fn: () => T): T {
        if (!enabled) return fn();
        console.groupCollapsed(`${icon} ${channel} | ${title}`);
        try {
            return fn();
        } finally {
            console.groupEnd();
        }
    }

    const log = (...args: any[]) => {
        if (enabled) console.log(prefix, ...args);
    };

    const warn = (...args: any[]) => {
        if (enabled) console.warn(prefix, ...args);
    };

    return { enabled, group, log, warn };
}
