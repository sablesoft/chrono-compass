// src/lib/time/types.ts
export type GlobalTimeState = {
    live: boolean;
    ts?: number;     // только если live=false
    locked: boolean; // блокирует “внешние” изменения глобального времени (от колёс)
};
