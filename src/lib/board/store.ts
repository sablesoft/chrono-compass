// src/lib/board/store.ts
import { writable, derived, get } from 'svelte/store';
import { nanoid } from 'nanoid';

import { debug } from '../debug';
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

import type { WheelObserverState, WheelTimeState } from '../wheel/types';
import {
    makeSolveKey,
    normalizeWheelObserver,
    normalizeWheelTime,
    dedupeWheelItemsById
} from '../wheel/id';
import type { BoardWheel } from './types';
import { DEFAULT_LOCATION_ID } from '../location/types';
import { DEFAULT_TIME } from '../time/types';

export type BoardState = {
    items: BoardWheel[];
    updatedAt: number;
};

const dbg = debug('board', '👤');

const KEY = 'chrono:board';

const DEFAULT_OBSERVER: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };

function now(): number {
    return Date.now();
}

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function normalizeOrder(items: BoardWheel[]): BoardWheel[] {
    return items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((x, i) => ({ ...x, order: i }));
}

function defaultCompassItem(order: number): BoardWheel {
    const wheelType: WheelType = 'compass';
    const roles: WheelRolesState = { looker: 'Earth', focus: null, target: ['Moon', 'Sun'] } as any;
    const observer: WheelObserverState = { ...DEFAULT_OBSERVER };
    const time: WheelTimeState = { ...DEFAULT_TIME };

    return {
        id: nanoid(),
        solveKey: makeSolveKey(wheelType, roles, observer, time),
        wheelType,
        title: 'Compass',
        roles,
        observer,
        time,
        order
    };
}

function ensureCompass(items: BoardWheel[], reason: string): BoardWheel[] {
    if (items.some((x) => x.wheelType === 'compass')) return items;

    dbg.warn('board.ensureCompass.inject', { reason });
    return [...items, defaultCompassItem(items.length)];
}

function normalizeBoard(input: any): BoardState {
    return dbg.group('board.normalize', () => {
        const t = now();
        const itemsRaw: any[] = Array.isArray(input?.items) ? input.items : [];

        const parsedItems: BoardWheel[] = itemsRaw
            .filter((x: any) => x && typeof x.wheelType === 'string')
            .map((x: any, i: number): BoardWheel => {
                const wheelType = x.wheelType as WheelType;

                const roles: WheelRolesState =
                    x.roles && typeof x.roles === 'object' ? (x.roles as WheelRolesState) : ({} as WheelRolesState);

                const observer: WheelObserverState = normalizeWheelObserver(x.observer, DEFAULT_LOCATION_ID);
                const time: WheelTimeState = normalizeWheelTime(x.time);

                // identity must be stable; if missing in persisted storage -> generate once
                const id = (typeof x.id === 'string' && x.id.length > 0) ? x.id : nanoid();

                return {
                    id,
                    solveKey: makeSolveKey(wheelType, roles, observer, time),
                    wheelType,
                    title: typeof x.title === 'string' ? x.title : '',
                    roles,
                    observer,
                    time,
                    order: Number.isFinite(x.order) ? (x.order as number) : i,
                    size: Number.isFinite(x.size) ? (x.size as number) : undefined
                };
            });

        let items = normalizeOrder(parsedItems);
        items = dedupeWheelItemsById(items);
        items = normalizeOrder(items);

        items = ensureCompass(items, 'normalizeBoard');

        const out: BoardState = {
            items,
            updatedAt: Number.isFinite(input?.updatedAt) ? (input.updatedAt as number) : t
        };

        dbg.log('board.normalize.ok', { count: out.items.length, updatedAt: out.updatedAt });
        return out;
    });
}

function loadBoard(): BoardState {
    return dbg.group('board.load', () => {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
        const parsed = safeParse<any>(raw, null);
        const state = normalizeBoard(parsed);

        if (!raw) {
            dbg.warn('board.load.noStorage', { count: state.items.length });
        }

        dbg.log('board.load.ok', { hasRaw: !!raw, count: state.items.length });
        return state;
    });
}

function saveBoard(state: BoardState) {
    dbg.group('board.save', () => {
        try {
            dbg.log('board.save.in', { count: state.items.length, updatedAt: state.updatedAt });
            localStorage.setItem(KEY, JSON.stringify(state));
            dbg.log('board.save.ok');
        } catch (err) {
            dbg.warn('board.save.fail', err);
        }
    });
}

export const boardState = writable<BoardState>(loadBoard());

boardState.subscribe((s: BoardState) => {
    saveBoard(s);
});

export const boardItems = derived(boardState, ($s: BoardState) =>
    $s.items.slice().sort((a, b) => a.order - b.order)
);

function setItems(nextItems: BoardWheel[], reason: string) {
    boardState.update(() => {
        let items = normalizeOrder(nextItems);
        items = dedupeWheelItemsById(items);
        items = normalizeOrder(items);
        items = ensureCompass(items, reason);

        const next: BoardState = { items, updatedAt: now() };
        dbg.log('board.setItems', { reason, count: next.items.length, updatedAt: next.updatedAt });
        return next;
    });
}

type WheelSelector =
    | { mode: 'updateById'; id: string }
    | { mode: 'upsertByKey' };

type WheelPatch = {
    wheelType?: WheelType;
    title?: string;
    roles?: WheelRolesState;
    observer?: Partial<WheelObserverState>;
    time?: Partial<WheelTimeState>;
    size?: number;
};

export const boardApi = {
    get(): BoardState {
        const s = get(boardState);
        dbg.log('boardApi.get', { count: s.items.length, updatedAt: s.updatedAt });
        return s;
    },

    getItems(): BoardWheel[] {
        const s = get(boardState);
        return s.items.slice().sort((a, b) => a.order - b.order);
    },

    hasSolveKey(solveKey: string): boolean {
        const cur = get(boardState).items;
        return cur.some((x) => x.solveKey === solveKey);
    },

    removeWheelById(id: string, reason = 'removeWheelById') {
        dbg.group('boardApi.removeWheelById', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x) => x.id !== id);

            dbg.log('removeWheelById', { id, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    updateWheelTime(
        id: string,
        patch: Partial<WheelTimeState>,
        reason = 'updateWheelTime'
    ) {
        dbg.group('boardApi.updateWheelTime', () => {
            const cur = get(boardState).items.slice();
            const idx = cur.findIndex((x) => x.id === id);
            if (idx < 0) {
                dbg.warn('updateWheelTime.notFound', { id, reason });
                return;
            }

            const prev = cur[idx];
            const nextTime: WheelTimeState = normalizeWheelTime(
                { ...(prev.time as any), ...(patch as any) }
            );

            const nextSolveKey = makeSolveKey(prev.wheelType, prev.roles, prev.observer, nextTime);

            // если конфликтует с другим колесом — блокируем
            const conflict = cur.some((x, i) => i !== idx && x.solveKey === nextSolveKey);
            if (conflict) {
                dbg.warn('updateWheelTime.conflict', { id, fromSolveKey: prev.solveKey, nextSolveKey, reason });
                return;
            }

            cur[idx] = {
                ...prev,
                // id сохраняем
                solveKey: nextSolveKey,
                time: nextTime
            };

            dbg.log('updated', { id, fromSolveKey: prev.solveKey, nextSolveKey, patch, reason });
            setItems(cur, reason);
        });
    },

    /**
     * Универсальный upsert.
     *
     * mode:
     * - updateById: обновить КОНКРЕТНЫЙ айтем (по id, пересчитает solveKey). При конфликте с другим solveKey — заблокирует.
     * - upsertByKey: upsert по вычисленному solveKey (если найден — обновит, иначе добавит новый id).
     *
     * Возвращает:
     * - ok=false если не нашёл базу (updateById) или конфликт
     * - nextSolveKey (если ok)
     */
    upsertWheel(sel: WheelSelector, patch: WheelPatch, reason = 'upsertWheel'): { ok: boolean; nextSolveKey?: string } {
        return dbg.group('boardApi.upsertWheel', () => {
            const cur = get(boardState).items.slice();

            const idx = sel.mode === 'updateById' ? cur.findIndex((x) => x.id === sel.id) : -1;
            const prev = idx >= 0 ? cur[idx] : null;

            if (sel.mode === 'updateById' && !prev) {
                dbg.warn('upsertWheel.notFound', { id: sel.id, reason });
                return { ok: false };
            }

            const wheelType: WheelType = patch.wheelType ?? prev?.wheelType ?? ('compass' as WheelType);
            const roles: WheelRolesState = patch.roles ?? prev?.roles ?? ({} as WheelRolesState);

            const observer: WheelObserverState = normalizeWheelObserver(
                { ...(prev?.observer ?? DEFAULT_OBSERVER), ...(patch.observer ?? {}) },
                DEFAULT_LOCATION_ID
            );

            const time: WheelTimeState = normalizeWheelTime({ ...(prev?.time ?? DEFAULT_TIME), ...(patch.time ?? {}) });

            const title: string = ((patch.title ?? prev?.title ?? '') as any) ?? '';
            const size: number | undefined = patch.size ?? prev?.size;

            const nextSolveKey = makeSolveKey(wheelType, roles, observer, time);

            if (sel.mode === 'updateById') {
                const conflict = cur.some((x, i) => i !== idx && x.solveKey === nextSolveKey);
                if (conflict) {
                    dbg.warn('upsertWheel.conflict', { mode: sel.mode, id: sel.id, fromSolveKey: prev!.solveKey, toSolveKey: nextSolveKey, reason });
                    return { ok: false };
                }

                cur[idx] = {
                    ...prev!,
                    // id НЕ меняем
                    solveKey: nextSolveKey,
                    wheelType,
                    roles,
                    observer,
                    time,
                    title,
                    size
                };

                dbg.log('upsertWheel.updatedById', { id: sel.id, fromSolveKey: prev!.solveKey, toSolveKey: nextSolveKey, reason });
                setItems(cur, reason);
                return { ok: true, nextSolveKey };
            }

            // upsertByKey
            const hit = cur.findIndex((x) => x.solveKey === nextSolveKey);

            if (hit >= 0) {
                const keep = cur[hit];
                cur[hit] = {
                    ...keep,
                    // keep.id + keep.order сохраняем
                    solveKey: nextSolveKey,
                    wheelType,
                    title,
                    roles,
                    observer,
                    time,
                    size: size ?? keep.size
                };

                dbg.log('upsertWheel.updatedByKey', { id: keep.id, solveKey: nextSolveKey, reason });
            } else {
                const id = nanoid();
                cur.push({
                    id,
                    solveKey: nextSolveKey,
                    wheelType,
                    title,
                    roles,
                    observer,
                    time,
                    order: cur.length,
                    size
                });

                dbg.log('upsertWheel.createdByKey', { id, solveKey: nextSolveKey, reason });
            }

            setItems(cur, reason);
            return { ok: true, nextSolveKey };
        });
    },

    // --- Compatibility wrappers (можно удалить позже, но удобно для миграции) ---

    updateWheelObserver(id: string, patch: Partial<WheelObserverState>, reason = 'updateWheelObserver') {
        return boardApi.upsertWheel({ mode: 'updateById', id }, { observer: patch }, reason);
    },

    setFromSnapshot(items: Omit<BoardWheel, 'order'>[], reason = 'setFromSnapshot') {
        dbg.group('boardApi.setFromSnapshot', () => {
            dbg.log('in', { reason, count: items.length });

            const next: BoardWheel[] = items.map((x, i): BoardWheel => {
                const wheelType = x.wheelType;
                const roles = x.roles ?? ({} as WheelRolesState);
                const observer = normalizeWheelObserver((x as any).observer, DEFAULT_LOCATION_ID);
                const time = normalizeWheelTime((x as any).time);
                const solveKey = makeSolveKey(wheelType, roles, observer, time);

                return {
                    id: x.id ? x.id : nanoid(),
                    solveKey,
                    wheelType,
                    title: x.title ?? '',
                    roles,
                    observer,
                    time,
                    size: x.size,
                    order: i
                };
            });

            setItems(normalizeBoard({ items: next, updatedAt: now() }).items, reason);
        });
    },

    upsertCompass(
        payload: {
            title: string;
            roles: WheelRolesState;
            observer?: Partial<WheelObserverState>;
            time?: Partial<WheelTimeState>;
            size?: number;
        },
        reason = 'upsertCompass'
    ) {
        return boardApi.upsertWheel(
            { mode: 'upsertByKey' },
            {
                wheelType: 'compass',
                roles: payload.roles,
                title: payload.title ?? 'Compass',
                observer: payload.observer,
                time: payload.time,
                size: payload.size
            },
            reason
        );
    },

    moveWheelById(
        id: string,
        dir: -1 | 1,
        opts?: { carouselWrap?: boolean },
        reason = 'moveWheelById'
    ) {
        dbg.group('boardApi.moveWheelById', () => {
            const carouselWrap = opts?.carouselWrap === true;

            const cur = get(boardState).items
                .slice()
                .sort((a, b) => a.order - b.order);

            const n = cur.length;
            if (n < 2) return;

            const from = cur.findIndex(x => x.id === id);
            if (from < 0) {
                dbg.warn('moveWheelById.notFound', { id, reason });
                return;
            }

            let to = from + dir;

            // wrap logic
            if (to < 0) {
                // moving left from first
                to = carouselWrap ? Math.max(0, n - 2) : (n - 1);
            } else if (to >= n) {
                // moving right from last
                to = carouselWrap ? Math.min(n - 1, 1) : 0;
            }

            if (to === from) {
                dbg.log('moveWheelById.noop', { id, from, to, dir, carouselWrap, reason });
                return;
            }

            const a = cur[from];
            const b = cur[to];

            // swap orders
            const next = cur.slice();
            next[from] = { ...a, order: b.order };
            next[to] = { ...b, order: a.order };

            dbg.log('moveWheelById.move', { id, from, to, dir, carouselWrap, reason });

            setItems(next, reason);
        });
    },
};
