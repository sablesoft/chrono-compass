// src/lib/board/dispatcher.ts
import type { WheelSolveResult } from './runtime';
import type { BoardWheel } from './types';
import { getWheelEntry } from './registry';

// Эти импорты возьми из того места, где они сейчас живут (Cycle.svelte -> lib?)
// И лучше вынести их из UI в отдельный модуль: src/lib/board/cache/cycles.ts
import {
    getLocalCycle,
    setLocalCycle,
    getPersistentCycle,
    putPersistentCycle,
    buildCycleDataFromSolve,
} from '../cycle/store';

type SolveCtx = { ts: number; location?: any; dbg?: any };

// Вариант: wheelId можно прокинуть снаружи (UI знает), либо хранить в wheel.instanceId
type ResolveOpts = {
    wheelId?: string;     // для local cache (per wheel instance)
    cycleKey?: string | null; // если уже есть готовый key; иначе попробуем взять из entry
    persist?: boolean;    // default true
    useIdb?: boolean;     // default true
    useLocal?: boolean;   // default true
};

const inflight = new Map<string, Promise<WheelSolveResult>>();

export function solveWheel(wheel: BoardWheel, ctx: SolveCtx): WheelSolveResult {
    const entry = getWheelEntry(wheel.wheelType);
    const input = entry.makeInput(wheel, ctx);
    return entry.solve(input as any);
}

// Нормализация времени для in-flight key (не для результата!)
// Иначе при скролле на миллисекунды будет бесконечный inflight-map.
function tsBucket(ts: number, bucketMs = 60_000): number {
    return Math.floor(ts / bucketMs) * bucketMs;
}

function defaultDbg(dbg: any) {
    const log = dbg?.log ?? (() => {});
    const warn = dbg?.warn ?? log;
    const error = dbg?.error ?? log;
    return { log, warn, error };
}

export async function resolveWheel(wheel: BoardWheel, ctx: SolveCtx, opts: ResolveOpts = {}): Promise<WheelSolveResult> {
    const entry = getWheelEntry(wheel.wheelType);
    const dbg = defaultDbg(ctx.dbg);

    // 0) compute-only wheels (no cycleKey) — просто считаем
    // Ты можешь сделать это более “официально” через entry.getCycleKey()
    const cycleKey =
        (opts.cycleKey ?? null) ??
        ((entry as any).getCycleKey ? (entry as any).getCycleKey(wheel) : null);

    if (!cycleKey) {
        return solveWheel(wheel, { ...ctx, dbg });
    }

    const wheelId =
        opts.wheelId ??
        (wheel as any).id ??
        (wheel as any).instanceId ??
        'wheel'; // fallback, но лучше реально иметь стабильный id

    const useLocal = opts.useLocal ?? true;
    const useIdb = opts.useIdb ?? true;
    const persist = opts.persist ?? true;

    // общий ключ для дедупликации запросов
    const keyInflight = `${wheel.wheelType}|${cycleKey}|${wheelId}|${tsBucket(ctx.ts, 60_000)}`;

    const existing = inflight.get(keyInflight);
    if (existing) return existing;

    const promise = (async (): Promise<WheelSolveResult> => {
        // 1) local cache
        if (useLocal) {
            try {
                const local = getLocalCycle(wheelId, cycleKey, ctx.ts);
                if (local) {
                    return {
                        ok: true,
                        kind: 'cycle',
                        ts: ctx.ts,
                        spokes: local.spokes ?? [],
                    } as any;
                }
            } catch (e) {
                dbg.log?.('resolveWheel.local.get failed', e);
            }
        }

        // 2) IndexedDB cache
        if (useIdb) {
            try {
                const fromDb = await getPersistentCycle(cycleKey, ctx.ts);
                if (fromDb) {
                    if (useLocal) {
                        try {
                            setLocalCycle(wheelId, cycleKey, fromDb);
                        } catch (e) {
                            dbg.log?.('resolveWheel.local.set failed', e);
                        }
                    }
                    return {
                        ok: true,
                        kind: 'cycle',
                        ts: ctx.ts,
                        spokes: fromDb.spokes ?? [],
                    } as any;
                }
            } catch (e) {
                dbg.log?.('resolveWheel.idb.get failed', e);
                // важно: НЕ падаем, просто идём считать
            }
        }

        // 3) compute via solver
        const res = solveWheel(wheel, { ...ctx, dbg });

        // Если это не цикл — просто отдаём как есть
        if (!res || (res as any).kind !== 'cycle') return res;

        const r: any = res;
        if (!r.ok) return res;

        // 4) build + save
        let built: any = null;
        try {
            built = buildCycleDataFromSolve(cycleKey, r);
        } catch (e) {
            dbg.log?.('resolveWheel.build failed', e);
        }

        if (built) {
            if (useLocal) {
                try {
                    setLocalCycle(wheelId, cycleKey, built);
                } catch (e) {
                    dbg.log?.('resolveWheel.local.set failed', e);
                }
            }
            if (useIdb && persist) {
                // Не блокируем ответ: запись async “fire-and-forget”
                putPersistentCycle(built).catch((e: any) => dbg.log?.('resolveWheel.idb.put failed', e));
            }
        }

        return res;
    })();

    inflight.set(keyInflight, promise);

    try {
        return await promise;
    } finally {
        inflight.delete(keyInflight);
    }
}
