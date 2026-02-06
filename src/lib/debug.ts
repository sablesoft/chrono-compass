// src/lib/debug.ts
type DebugApi = {
    enabled: boolean;
    group<T>(title: string, fn: () => T): T;
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
};

function camelToSnakeUpper(s: string): string {
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // aB -> a_B
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // ABc -> A_Bc
        .toUpperCase();
}

function envFlag(name: string): boolean {
    // Vite отдаёт строки. Разрешим "true"/"1"/"yes"/"on".
    const v = (import.meta as any)?.env?.[name];
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/**
 * Общая схема:
 * - VITE_DEBUG=true включает вообще всё
 * - VITE_DEBUG_<CHANNEL_SNAKE_CASE>=true включает конкретный канал
 * - если хочешь "только в dev": добавь import.meta.env.DEV снаружи или здесь (см. ниже)
 */
function isEnabled(channel: string): boolean {
    const key = camelToSnakeUpper(channel);

    const all = envFlag('VITE_DEBUG');
    const per = envFlag(`VITE_DEBUG_${key}`);

    return all || per;
}

export function debug(channel: string, icon = '🐞'): DebugApi {
    // ВАЖНО: вычисляется один раз при загрузке модуля (после перезапуска dev сервера).
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

    const log = (...args: any[]) => { if (enabled) console.log(prefix, ...args); };
    const warn = (...args: any[]) => { if (enabled) console.warn(prefix, ...args); };

    return { enabled, group, log, warn };
}
