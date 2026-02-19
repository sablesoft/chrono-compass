// src/lib/time/types.ts
import type {WheelTimeState} from "../wheel/types";

export type GlobalTimeState = {
    live: boolean;
    ts?: number;     // только если live=false
    locked: boolean; // блокирует “внешние” изменения глобального времени (от колёс)
};

export const DEFAULT_TIME: WheelTimeState = { live: true, locked: false };
