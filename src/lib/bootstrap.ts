// src/lib/bootstrap.ts
import { registerWheel } from './board/registry';

import { solveBindWheel } from './cycles/bind';
import { solveCompassWheel } from './compass';

import type { WheelRegistryEntry } from './board/registry';

export function registerWheels() {
    // bind...
    registerWheel({
        type: 'bind',
        ui: 'cycle',
        makeInput: (wheel, ctx) => ({
            ts: ctx.ts,
            location: ctx.location,
            dbg: ctx.dbg,
            looker: (wheel.roles as any)?.looker ?? undefined,
            focus: (wheel.roles as any)?.focus ?? undefined,
            target: (wheel.roles as any)?.target
        }),
        solve: (input) => solveBindWheel(input)
    } satisfies WheelRegistryEntry);

    // compass...
    registerWheel({
        type: 'compass',
        ui: 'compass',
        makeInput: (wheel, ctx) => ({
            ts: ctx.ts,
            location: ctx.location, // ОБЯЗАТЕЛЬНО для компаса
            dbg: ctx.dbg,
            looker: (wheel.roles as any)?.looker ?? 'Earth',
            focus: (wheel.roles as any)?.focus ?? undefined, // не нужен, но пусть будет
            target: (wheel.roles as any)?.target // у компаса может быть BodyId[]
        }),
        solve: (input) => solveCompassWheel(input)
    } satisfies WheelRegistryEntry);

    // TODO остальные...
}
