// src/lib/board/dispatcher.ts
import type { WheelSolveResult, CycleSolveResult } from './runtime';
import type { BoardWheel } from './types';
import type { ObjId } from '../catalog';
import { platoLookerAnchor } from '../math/plato';
import { isTsWithinWheelTimeframe } from '../wheel/timeframe';

import { getCycle, putCycleSolved } from '../cycle/store';

import { getWheelEntry, resolveWheelMeta } from './registry';
import type {CacheWheelLike} from "../cycle/types";

type SolveCtx = { ts: number; location?: any; dbg?: any };
const TAGGED_CYCLE_TYPES = new Set<string>(['horizon', 'synod', 'bind', 'nodal']);

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

function needsSpokeTagBackfill(wheelType: string, spokes: any[]): boolean {
    if (!TAGGED_CYCLE_TYPES.has(String(wheelType))) return false;
    if (!Array.isArray(spokes) || spokes.length === 0) return true;
    return spokes.some((s) => !Array.isArray(s?.tags) || s.tags.length === 0);
}

async function solveRaw(wheel: BoardWheel | CacheWheelLike, ctx: SolveCtx): Promise<WheelSolveResult> {
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

function attachTemplateUpdater(
    wheelLike: CacheWheelLike,
    res: WheelSolveResult
): WheelSolveResult {
    if (!res || typeof res !== 'object') return res;

    if (String(wheelLike.wheelType) === 'plato') {
        const looker = (wheelLike.roles as any)?.looker as ObjId | undefined;
        return {
            ...(res as any),
            templateConfigUpdater: () => ({ ui: { looker: platoLookerAnchor(looker) } })
        } as WheelSolveResult;
    }

    return res;
}

/**
 * Single entry point.
 * Cache policy + runtime/idb are encapsulated in cycle/store.
 */
export async function resolveWheel(wheel: BoardWheel | CacheWheelLike, ctx: SolveCtx): Promise<WheelSolveResult> {
    const dbg = dbgApi(ctx.dbg);

    const wheelLike = toCacheWheelLike(wheel);
    const entry = getWheelEntry((wheel as any).wheelType);

    if (!isTsWithinWheelTimeframe(ctx.ts)) {
        if (entry.ui === 'compass') {
            return {
                ok: false,
                kind: 'compass',
                ts: ctx.ts,
                reason: 'Requested timestamp is outside supported global timeframe',
                bodies: []
            } as WheelSolveResult;
        }
        return {
            ok: false,
            kind: 'cycle',
            ts: ctx.ts,
            reason: 'Requested timestamp is outside supported global timeframe',
            spokes: []
        } as WheelSolveResult;
    }

    // 1) try cache (runtime -> idb -> runtime update inside store)
    try {
        const hit = await getCycle(wheelLike, ctx.ts);
        if (hit) {
            if (needsSpokeTagBackfill(String(wheelLike.wheelType), hit.spokes as any[])) {
                const recomputed = await solveRaw(wheel, { ...ctx, dbg });
                if (recomputed && (recomputed as any).kind === 'cycle' && (recomputed as any).ok) {
                    try {
                        await putCycleSolved(wheelLike, recomputed as CycleSolveResult);
                    } catch (e) {
                        dbg.log('resolveWheel.cache.put(backfill) failed', e);
                    }
                    return attachTemplateUpdater(wheelLike, recomputed as any) as any;
                }
            }
            return attachTemplateUpdater(
                wheelLike,
                { ok: true, kind: 'cycle', ts: ctx.ts, spokes: hit.spokes } as any
            ) as any;
        }
    } catch (e) {
        dbg.log('resolveWheel.cache.get failed', e);
    }

    // 2) compute
    const res = await solveRaw(wheel, { ...ctx, dbg });

    // 3) if this is a successful cycle -> write to cache (runtime + persistent inside store)
    if (res && (res as any).kind === 'cycle') {
        const r = res as CycleSolveResult;
        if (r.ok) {
            try {
                await putCycleSolved(wheelLike, r);
            } catch (e) {
                dbg.log('resolveWheel.cache.put failed', e);
            }
        }
    }

    return attachTemplateUpdater(wheelLike, res);
}
