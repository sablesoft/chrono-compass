// src/lib/board/store.ts
import { writable, derived, get } from 'svelte/store';

import { debug } from '../debug';
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

import type { WheelObserverState, WheelTimeState } from '../wheel/types';
import {
    makeWheelId,
    normalizeWheelObserver,
    normalizeWheelTime,
    dedupeWheelItemsById
} from '../wheel/id';
import type {BoardWheel} from "./types";

export type BoardState = {
    items: BoardWheel[];
    updatedAt: number;
};

const dbg = debug('board', '👤');

const KEY = 'chrono:board';

const DEFAULT_LOCATION_ID = 'loc:system';
const DEFAULT_OBSERVER: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };
const DEFAULT_TIME: WheelTimeState = { live: true, locked: false };

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
        wheelId: makeWheelId(wheelType, roles, observer, time),
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

                const wheelId = makeWheelId(wheelType, roles, observer, time);

                return {
                    wheelId,
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
            if (!raw) dbg.warn('board.load.noStorage', { count: state.items.length });
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
        const next: BoardState = { items, updatedAt: now() };
        dbg.log('board.setItems', { reason, count: next.items.length, updatedAt: next.updatedAt });
        return next;
    });
}

type WheelSelector =
    | { mode: 'updateById'; wheelId: string }
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

    hasWheelId(wheelId: string): boolean {
        const cur = get(boardState).items;
        return cur.some((x) => x.wheelId === wheelId);
    },

    removeWheelById(wheelId: string, reason = 'removeWheelById') {
        dbg.group('boardApi.removeWheelById', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x) => x.wheelId !== wheelId);

            dbg.log('removeWheelById', { wheelId, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    updateWheelTime(
        wheelId: string,
        patch: Partial<WheelTimeState>,
        reason = 'updateWheelTime'
    ) {
        dbg.group('boardApi.updateWheelTime', () => {
            const cur = get(boardState).items.slice();
            const idx = cur.findIndex((x) => x.wheelId === wheelId);
            if (idx < 0) return;

            const prev = cur[idx];
            const nextTime: WheelTimeState = normalizeWheelTime(
                { ...(prev.time as any), ...(patch as any) }
            );

            const nextWheelId = makeWheelId(prev.wheelType, prev.roles, prev.observer, nextTime);

            // если конфликтует с другим колесом — блокируем
            const conflict = cur.some((x, i) => i !== idx && x.wheelId === nextWheelId);
            if (conflict) {
                dbg.warn('updateWheelTime.conflict', { wheelId, nextWheelId, reason });
                return;
            }

            cur[idx] = {
                ...prev,
                wheelId: nextWheelId,
                time: nextTime
            };

            dbg.log('updated', { wheelId, nextWheelId, patch, reason });
            setItems(cur, reason);
        });
    },

    /**
     * Универсальный upsert.
     *
     * mode:
     * - updateById: обновить КОНКРЕТНЫЙ айтем (пересчитает wheelId). При конфликте с другим wheelId — заблокирует.
     * - upsertByKey: upsert по вычисленному wheelId (если найден — заменит, иначе добавит).
     *
     * Возвращает:
     * - ok=false если не нашёл базу (updateById) или конфликт
     * - nextWheelId (если ok)
     */
    upsertWheel(sel: WheelSelector, patch: WheelPatch, reason = 'upsertWheel'): { ok: boolean; nextWheelId?: string } {
        return dbg.group('boardApi.upsertWheel', () => {
            const cur = get(boardState).items.slice();

            const idx = sel.mode === 'updateById' ? cur.findIndex((x) => x.wheelId === sel.wheelId) : -1;
            const prev = idx >= 0 ? cur[idx] : null;

            if (sel.mode === 'updateById' && !prev) {
                dbg.warn('upsertWheel.notFound', { wheelId: sel.wheelId, reason });
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

            const nextWheelId = makeWheelId(wheelType, roles, observer, time);

            if (sel.mode === 'updateById') {
                // конфликт: другой айтем уже имеет nextWheelId
                const conflict = cur.some((x, i) => i !== idx && x.wheelId === nextWheelId);
                if (conflict) {
                    dbg.warn('upsertWheel.conflict', { mode: sel.mode, from: sel.wheelId, to: nextWheelId, reason });
                    return { ok: false };
                }

                cur[idx] = {
                    ...prev!,
                    wheelId: nextWheelId,
                    wheelType,
                    roles,
                    observer,
                    time,
                    title,
                    size
                };

                dbg.log('upsertWheel.updatedById', { from: sel.wheelId, to: nextWheelId, reason });
                setItems(cur, reason);
                return { ok: true, nextWheelId };
            }

            // upsertByKey
            const hit = cur.findIndex((x) => x.wheelId === nextWheelId);
            const order = hit >= 0 ? cur[hit].order : cur.length;

            const nextItem: BoardWheel = {
                wheelId: nextWheelId,
                wheelType,
                title,
                roles,
                observer,
                time,
                order,
                size
            };

            if (hit >= 0) {
                cur[hit] = { ...nextItem, order: cur[hit].order, size: size ?? cur[hit].size };
                dbg.log('upsertWheel.updatedByKey', { wheelId: nextWheelId, reason });
            } else {
                cur.push(nextItem);
                dbg.log('upsertWheel.createdByKey', { wheelId: nextWheelId, reason });
            }

            setItems(cur, reason);
            return { ok: true, nextWheelId };
        });
    },

    // --- Compatibility wrappers (можно удалить позже, но удобно для миграции) ---

    updateWheelObserver(wheelId: string, patch: Partial<WheelObserverState>, reason = 'updateWheelObserver') {
        return boardApi.upsertWheel({ mode: 'updateById', wheelId }, { observer: patch }, reason);
    },

    updateWheelRolesAndTitle(
        wheelId: string,
        patch: { roles?: WheelRolesState; title?: string },
        reason = 'updateWheelRolesAndTitle'
    ) {
        return boardApi.upsertWheel({ mode: 'updateById', wheelId }, { roles: patch.roles, title: patch.title }, reason);
    },

    addWheelFromBase(
        baseWheelId: string,
        payload: { wheelType: WheelType; roles: WheelRolesState; title: string },
        reason = 'addWheelFromBase'
    ) {
        return dbg.group('boardApi.addWheelFromBase', () => {
            const cur = get(boardState).items.slice();
            const base = cur.find((x) => x.wheelId === baseWheelId);
            if (!base) {
                dbg.warn('addWheelFromBase.notFound', { baseWheelId, reason });
                return { ok: false as const };
            }

            const nextWheelId = makeWheelId(payload.wheelType, payload.roles, base.observer, base.time);
            if (cur.some((x) => x.wheelId === nextWheelId)) {
                dbg.warn('addWheelFromBase.exists', { baseWheelId, nextWheelId, reason });
                return { ok: false as const };
            }

            return boardApi.upsertWheel(
                { mode: 'upsertByKey' },
                {
                    wheelType: payload.wheelType,
                    roles: payload.roles,
                    title: payload.title ?? '',
                    observer: base.observer,
                    time: base.time,
                    size: base.size
                },
                reason
            );
        });
    },

    setFromSnapshot(items: Omit<BoardWheel, 'order'>[], reason = 'setFromSnapshot') {
        dbg.group('boardApi.setFromSnapshot', () => {
            dbg.log('in', { reason, count: items.length });

            const next: BoardWheel[] = items.map((x, i): BoardWheel => {
                const wheelType = x.wheelType;
                const roles = x.roles ?? ({} as WheelRolesState);
                const observer = normalizeWheelObserver((x as any).observer, DEFAULT_LOCATION_ID);
                const time = normalizeWheelTime((x as any).time);
                const wheelId = makeWheelId(wheelType, roles, observer, time);

                return {
                    wheelId,
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

    removeWheelType(type: WheelType, reason = 'removeWheelType') {
        dbg.group('boardApi.removeWheelType', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x) => x.wheelType !== type);
            dbg.log('remove', { type, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    reorder(nextWheelIds: string[], reason = 'reorder') {
        dbg.group('boardApi.reorder', () => {
            const cur = get(boardState).items.slice();
            const byId = new Map<string, BoardWheel>(cur.map((x) => [x.wheelId, x]));
            const next: BoardWheel[] = [];

            for (const id of nextWheelIds) {
                const it = byId.get(id);
                if (it) next.push(it);
            }
            for (const it of cur) {
                if (!next.some((x) => x.wheelId === it.wheelId)) next.push(it);
            }

            dbg.log('reorder', { reason, count: next.length, order: next.map((x) => x.wheelId) });
            setItems(next, reason);
        });
    },

    clear(reason = 'clear') {
        dbg.group('boardApi.clear', () => {
            dbg.warn('boardApi.clear', { reason });
            setItems([], reason);
        });
    }
};
