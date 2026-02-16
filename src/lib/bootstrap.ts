// src/lib/bootstrap.ts
import { registerWheel, resolveWheelMeta } from './board/registry';

import { solveBindWheel } from './math/bind';
import { solveCompassWheel } from './math/compass';

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
            target: (wheel.roles as any)?.target, // у компаса может быть BodyId[]
            // meta не обязателен; можно не прокидывать
        }),
        solve: (input) => solveCompassWheel(input as any),
    } satisfies WheelRegistryEntry<'compass'>);

    // TODO остальные...
}
