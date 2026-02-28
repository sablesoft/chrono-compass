// src/lib/debug.ts
import { envBool, type EnvKey } from './env';

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

const KNOWN_CHANNELS: Readonly<Record<string, EnvKey>> = {
    APP: 'DEBUG_APP',
    LOCATION: 'DEBUG_LOCATION',
    COMPASS: 'DEBUG_COMPASS',
    PROFILE: 'DEBUG_PROFILE',
    CONTROL: 'DEBUG_CONTROL',
    BOARD: 'DEBUG_BOARD',
    WHEEL: 'DEBUG_WHEEL',
    CYCLE: 'DEBUG_CYCLE',
    DIURNAL: 'DEBUG_DIURNAL',
    LUNAR_SYNODIC: 'DEBUG_LUNAR_SYNODIC',
    LUNAR_DRACONIC: 'DEBUG_LUNAR_DRACONIC',
    LUNAR_ANOMALISTIC: 'DEBUG_LUNAR_ANOMALISTIC',
    SOLAR_TROPICAL: 'DEBUG_SOLAR_TROPICAL',
    SOLAR_ANOMALISTIC: 'DEBUG_SOLAR_ANOMALISTIC',
    PLATO: 'DEBUG_PLATO',
};

function isEnabled(channel: string): boolean {
    const all = envBool('DEBUG', false);

    const key = camelToSnakeUpper(channel);
    const mapped = KNOWN_CHANNELS[key];
    const per = mapped ? envBool(mapped, false) : false;

    return all || per;
}

export function debug(channel: string, icon = '🐞'): DebugApi {
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
