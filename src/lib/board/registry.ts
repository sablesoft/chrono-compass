// src/lib/board/registry.ts
import type { WheelType } from '../catalog';
import { wheels } from '../catalog';
import type { WheelInput, WheelSolveResult } from './runtime';
import type { BoardWheel } from './types';

export type WheelUiKind = 'compass' | 'cycle';

export type WheelRegistryEntry<TType extends WheelType = WheelType> = {
    type: TType;
    ui: WheelUiKind;

    makeInput: (wheel: BoardWheel, ctx: { ts: number; location?: any; dbg?: any }) => WheelInput<TType>;
    solve: (input: WheelInput<TType>) => WheelSolveResult;
};

export const wheelRegistry: Record<string, WheelRegistryEntry<any>> = Object.create(null);

export function registerWheel<TType extends WheelType>(entry: WheelRegistryEntry<TType>) {
    wheelRegistry[entry.type] = entry as WheelRegistryEntry<any>;
}

export function getWheelEntry<TType extends WheelType>(type: TType): WheelRegistryEntry<TType> {
    const e = wheelRegistry[type];
    if (!e) throw new Error(`No wheel registry entry for type="${type}"`);
    return e as WheelRegistryEntry<TType>;
}

/* ---------------------------
   Meta resolving from catalog
   --------------------------- */

function asBodyIdOrNull(v: any): string | null {
    return typeof v === 'string' && v.length ? v : null;
}

function pickTargetRoleValue(raw: any): string | null {
    if (Array.isArray(raw)) return asBodyIdOrNull(raw[0]);
    return asBodyIdOrNull(raw);
}

function matchCombo(combo: any, roles: any): boolean {
    // combo fields are arrays of allowed ObjId, roles fields are selected ObjId
    if (combo.looker) {
        const v = asBodyIdOrNull(roles.looker);
        if (v && !combo.looker.includes(v)) return false;
        if (!v) return false; // если combo требует looker, а его нет — не матч
    }
    if (combo.focus) {
        const v = asBodyIdOrNull(roles.focus);
        if (v && !combo.focus.includes(v)) return false;
        if (!v) return false;
    }
    if (combo.target) {
        const v = pickTargetRoleValue(roles.target);
        if (v && !combo.target.includes(v)) return false;
        if (!v) return false;
    }
    return true;
}

export function resolveWheelMeta<TType extends WheelType>(wheel: BoardWheel): any | undefined {
    const type = wheel.wheelType as TType;
    const spec: any = (wheels as any)[type];
    if (!spec) return undefined;

    const roles = (wheel as any).roles ?? {};
    const combos: any[] = Array.isArray(spec.roles) ? spec.roles : [];

    const hit = combos.find(c => matchCombo(c, roles));
    return hit?.meta;
}
