// src/lib/board/dispatcher.ts
import type { WheelSolveResult, CycleSolveResult } from './runtime';
import type { BoardWheel } from './types';

import { getCycle, putCycleSolved } from '../cycle/store';

import { getWheelEntry, resolveWheelMeta } from './registry';
import type {CacheWheelLike} from "../cycle/types";

type SolveCtx = { ts: number; location?: any; dbg?: any };

function dbgApi(dbg: any) {
    const log = dbg?.log ?? (() => {});
    const warn = dbg?.warn ?? log;
    const error = dbg?.error ?? log;
    return { log, warn, error };
}

function isBoardWheel(w: any): w is BoardWheel {
    return !!w && typeof w === 'object' && typeof w.id === 'string' && typeof w.wheelType === 'string';
}

function toCacheWheelLike(w: BoardWheel | CacheWheelLike): CacheWheelLike {
    const anyw: any = w as any;
    return {
        wheelType: anyw.wheelType,
        roles: anyw.roles ?? {},
        observer: anyw.observer, // может быть undefined у виртуальных
    };
}

function solveRaw(wheel: BoardWheel | CacheWheelLike, ctx: SolveCtx): WheelSolveResult {
    const wAny: any = wheel as any;
    const entry = getWheelEntry(wAny.wheelType);

    // meta имеет смысл в основном для "реальных" board wheels
    const meta = isBoardWheel(wheel) ? resolveWheelMeta(wheel as any) : undefined;

    // Если wheel реально на доске — доверяем entry.makeInput (там может быть хитрая нормализация)
    const input = isBoardWheel(wheel)
        ? entry.makeInput(wheel as any, ctx)
        : ({
            wheelType: wAny.wheelType,
            ts: ctx.ts,
            location: ctx.location,
            dbg: ctx.dbg,
            meta,
            ...(wAny.roles ?? {}),
        } as any);

    return entry.solve(input);
}

/**
 * Single entry point.
 * Cache policy + runtime/idb are encapsulated in cycle/store.
 */
export async function resolveWheel(wheel: BoardWheel | CacheWheelLike, ctx: SolveCtx): Promise<WheelSolveResult> {
    const dbg = dbgApi(ctx.dbg);

    const wheelLike = toCacheWheelLike(wheel);

    // 1) try cache (runtime -> idb -> runtime update inside store)
    try {
        const hit = await getCycle(wheelLike, ctx.ts);
        if (hit) {
            return { ok: true, kind: 'cycle', ts: ctx.ts, spokes: hit.spokes } as any;
        }
    } catch (e) {
        dbg.log('resolveWheel.cache.get failed', e);
    }

    // 2) compute
    const res = solveRaw(wheel, { ...ctx, dbg });

    // 3) if this is a successful cycle -> write to cache (runtime + persistent inside store)
    if (res && (res as any).kind === 'cycle') {
        const r = res as CycleSolveResult<any>;
        if (r.ok) {
            try {
                await putCycleSolved(wheelLike, r);
            } catch (e) {
                dbg.log('resolveWheel.cache.put failed', e);
            }
        }
    }

    return res;
}
