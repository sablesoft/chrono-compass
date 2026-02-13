// src/lib/board/registry.ts
import type { WheelType } from '../catalog';
import type { WheelInput, WheelSolveResult } from './runtime';
import type {BoardWheel} from "./types";

// какой шаблон рендерить
export type WheelUiKind = 'compass' | 'cycle';

// контракт для каждого wheelType
export type WheelRegistryEntry = {
    type: WheelType;
    ui: WheelUiKind;

    // делаем input из board-wheel + runtime (ts/location)
    // тут как раз живёт знание “нужен observer или нет”
    makeInput: (wheel: BoardWheel, ctx: { ts: number; location?: any; dbg?: any }) => WheelInput;

    // запустить алгоритм
    solve: (input: WheelInput) => WheelSolveResult;
};

// реестр
export const wheelRegistry: Record<string, WheelRegistryEntry> = Object.create(null);

// helper
export function registerWheel(entry: WheelRegistryEntry) {
    wheelRegistry[entry.type] = entry;
}

export function getWheelEntry(type: WheelType): WheelRegistryEntry {
    const e = wheelRegistry[type];
    if (!e) throw new Error(`No wheel registry entry for type="${type}"`);
    return e;
}
