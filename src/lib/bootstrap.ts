// src/lib/bootstrap.ts
import { registerWheel, resolveWheelMeta } from './board/registry';

import { solveBindWheel } from './math/bind';
import { solveCompassWheel } from './math/compass';
import { solveHorizonWheel } from './math/horizon';
import { solveSynodWheel } from "./math/synod";
import { solveSystemWheel } from './math/system';

import type { WheelRegistryEntry } from './board/registry';
import { initLocation } from './location/store';

export async function bootstrap() {
    registerWheels();
    await initLocation();
}

function registerWheels() {
    // bind...
    registerWheel({
        type: 'bind',
        ui: 'cycle',
        makeInput: (wheel, ctx) => ({
            wheelType: 'bind',
            ts: ctx.ts,
            location: ctx.location,
            dbg: ctx.dbg,

            looker: (wheel.roles as any)?.looker ?? undefined,
            focus: (wheel.roles as any)?.focus ?? undefined,
            target: (wheel.roles as any)?.target,

            // NEW: meta from catalog role-combo
            meta: resolveWheelMeta(wheel),
        }),
        solve: (input) => solveBindWheel(input as any),
    } satisfies WheelRegistryEntry<'bind'>);

    // compass...
    registerWheel({
        type: 'compass',
        ui: 'compass',
        makeInput: (wheel, ctx) => ({
            wheelType: 'compass',
            ts: ctx.ts,
            location: ctx.location, // ОБЯЗАТЕЛЬНО для компаса
            dbg: ctx.dbg,

            looker: (wheel.roles as any)?.looker ?? 'Earth',
            focus: (wheel.roles as any)?.focus ?? undefined, // не нужен, но пусть будет
            target: (wheel.roles as any)?.target, // у компаса может быть ObjId[]
            // meta не обязателен; можно не прокидывать
        }),
        solve: (input) => solveCompassWheel(input as any),
    } satisfies WheelRegistryEntry<'compass'>);

    // horizon...
    registerWheel({
        type: 'horizon',
        ui: 'cycle',
        makeInput: (wheel, ctx) => ({
            wheelType: 'horizon',
            ts: ctx.ts,
            location: ctx.location, // ОБЯЗАТЕЛЬНО для horizon
            dbg: ctx.dbg,

            looker: (wheel.roles as any)?.looker ?? 'Earth',
            focus: (wheel.roles as any)?.focus ?? undefined, // не нужен
            target: (wheel.roles as any)?.target, // у horizon всегда один
            // meta пока не обязательна; можно не прокидывать
        }),
        solve: (input) => solveHorizonWheel(input as any),
    } satisfies WheelRegistryEntry<'horizon'>);

    registerWheel({
        type: 'synod',
        ui: 'cycle',
        makeInput: (wheel, ctx) => ({
            wheelType: 'synod',
            ts: ctx.ts,
            location: ctx.location, // не нужен для synod
            dbg: ctx.dbg,

            looker: (wheel.roles as any)?.looker,
            focus: (wheel.roles as any)?.focus,
            target: (wheel.roles as any)?.target, // у synod всегда один
            // meta пока не обязательна; можно не прокидывать
        }),
        solve: (input) => solveSynodWheel(input as any),
    } satisfies WheelRegistryEntry<'synod'>);

    registerWheel({
        type: 'system',
        ui: 'compass',
        makeInput: (wheel, ctx) => ({
            wheelType: 'system',
            ts: ctx.ts,
            location: ctx.location,
            dbg: ctx.dbg,

            looker: (wheel.roles as any)?.looker,
            focus: (wheel.roles as any)?.focus,
            target: (wheel.roles as any)?.target,
            meta: resolveWheelMeta(wheel),
        }),
        solve: (input) => solveSystemWheel(input as any),
    } satisfies WheelRegistryEntry<'system'>);

    // TODO остальные...
}
