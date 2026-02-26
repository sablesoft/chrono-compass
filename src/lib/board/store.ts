// src/lib/board/store.ts
import { writable, derived, get } from 'svelte/store';
import { nanoid } from 'nanoid';

import { debug } from '../debug';
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

import type { WheelObserverState, WheelTimeState } from '../wheel/types';

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

/**
 * Нормализация time согласно требованиям:
 * - live=true => ts отсутствует
 * - live=false => ts обязателен
 */
function normalizeWheelTime(input: any, fallbackTs?: number): WheelTimeState {
    const locked = !!input?.locked;

    const live = input?.live === true || input?.live === 'true';
    if (live) return { live: true, locked };

    // fixed
    const ts = Number(input?.ts);
    if (Number.isFinite(ts)) return { live: false, ts: Math.trunc(ts), locked };

    // если нет ts — деградируем в live (или используем fallbackTs если дали)
    if (Number.isFinite(fallbackTs)) return { live: false, ts: Math.trunc(fallbackTs!), locked };
    return { live: true, locked };
}

function normalizeWheelObserver(input: any, fallbackLocationId: string): WheelObserverState {
    const locationId = (typeof input?.locationId === 'string' && input.locationId.trim().length)
        ? input.locationId.trim()
        : fallbackLocationId;

    return {
        locationId,
        locked: !!input?.locked
    };
}

/**
 * Dedup: оставляет первый по order, но стабилизирует order после.
 */
function dedupeWheelItemsById<T extends { id: string; order: number }>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];

    for (const it of items) {
        if (!it?.id) continue;
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
    }

    return out
        .sort((a, b) => a.order - b.order)
        .map((x, i) => ({ ...x, order: i }));
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
                    x.roles && typeof x.roles === 'object'
                        ? (x.roles as WheelRolesState)
                        : ({} as WheelRolesState);

                const observer: WheelObserverState = normalizeWheelObserver(x.observer, DEFAULT_LOCATION_ID);
                const time: WheelTimeState = normalizeWheelTime(x.time);

                // identity must be stable; if missing in persisted storage -> generate once
                const id = typeof x.id === 'string' && x.id.length > 0 ? x.id : nanoid();

                return {
                    id,
                    wheelType,
                    title: typeof x.title === 'string' ? x.title : '',
                    roles,
                    observer,
                    time,
                    order: Number.isFinite(x.order) ? (x.order as number) : i,
                    size: Number.isFinite(x.size) ? (x.size as number) : undefined
                };
            });

        // board can be empty; no default injections
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

        if (!raw) dbg.warn('board.load.noStorage', { count: state.items.length });

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

    getById(id: string): BoardWheel | null {
        const cur = get(boardState).items;
        return cur.find((x) => x.id === id) ?? null;
    },

    /**
     * Create a NEW wheel instance on board (duplicates allowed).
     * Returns new id.
     */
    addWheel(
        input: {
            wheelType: WheelType;
            title?: string;
            roles?: WheelRolesState;
            observer?: WheelObserverState;
            time?: WheelTimeState;
            size?: number;
        },
        reason = 'addWheel'
    ): string {
        return dbg.group('boardApi.addWheel', () => {
            const cur = get(boardState).items.slice();

            const wheelType = input.wheelType;
            const roles = (input.roles ?? ({} as WheelRolesState)) as WheelRolesState;

            const observer = normalizeWheelObserver(input.observer ?? DEFAULT_OBSERVER, DEFAULT_LOCATION_ID);
            const time = normalizeWheelTime(input.time ?? DEFAULT_TIME);

            const id = nanoid();
            const order = cur.length;

            const item: BoardWheel = {
                id,
                wheelType,
                title: (input.title ?? '').toString(),
                roles,
                observer,
                time,
                order,
                size: input.size
            };

            cur.push(item);

            dbg.log('boardApi.addWheel.ok', { id, wheelType, order, reason });
            setItems(cur, reason);
            return id;
        });
    },

    removeWheelById(id: string, reason = 'removeWheelById') {
        dbg.group('boardApi.removeWheelById', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x) => x.id !== id);

            dbg.log('removeWheelById', { id, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    updateWheelById(id: string, patch: WheelPatch, reason = 'updateWheelById') {
        dbg.group('boardApi.updateWheelById', () => {
            const cur = get(boardState).items.slice();
            const idx = cur.findIndex((x) => x.id === id);
            if (idx < 0) {
                dbg.warn('updateWheelById.notFound', { id, reason });
                return;
            }

            const prev = cur[idx];

            const wheelType: WheelType = patch.wheelType ?? prev.wheelType;
            const roles: WheelRolesState = patch.roles ?? prev.roles;

            const observer: WheelObserverState = patch.observer
                ? normalizeWheelObserver({ ...prev.observer, ...patch.observer }, DEFAULT_LOCATION_ID)
                : prev.observer;

            const time: WheelTimeState = patch.time
                ? normalizeWheelTime({ ...(prev.time as any), ...(patch.time as any) })
                : prev.time;

            const title: string = patch.title !== undefined ? String(patch.title ?? '') : prev.title;
            const size: number | undefined = patch.size !== undefined ? patch.size : prev.size;

            cur[idx] = {
                ...prev,
                wheelType,
                roles,
                observer,
                time,
                title,
                size
            };

            dbg.log('updateWheelById.ok', { id, reason });
            setItems(cur, reason);
        });
    },

    updateWheelObserver(id: string, patch: Partial<WheelObserverState>, reason = 'updateWheelObserver') {
        return boardApi.updateWheelById(id, { observer: patch }, reason);
    },

    updateWheelTime(id: string, patch: Partial<WheelTimeState>, reason = 'updateWheelTime') {
        return boardApi.updateWheelById(id, { time: patch }, reason);
    },

    setFromSnapshot(items: Array<Omit<BoardWheel, 'order' | 'id'> & { id?: string }>, reason = 'setFromSnapshot') {
        dbg.group('boardApi.setFromSnapshot', () => {
            dbg.log('in', { reason, count: items.length });

            const next: BoardWheel[] = items.map((x, i): BoardWheel => {
                const wheelType = x.wheelType;
                const roles = x.roles ?? ({} as WheelRolesState);

                const observer = normalizeWheelObserver((x as any).observer ?? DEFAULT_OBSERVER, DEFAULT_LOCATION_ID);
                const time = normalizeWheelTime((x as any).time ?? DEFAULT_TIME);

                const id = typeof (x as any).id === 'string' && (x as any).id.length ? (x as any).id : nanoid();

                return {
                    id,
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

    moveWheelById(id: string, dir: -1 | 1, opts?: { carouselWrap?: boolean }, reason = 'moveWheelById') {
        dbg.group('boardApi.moveWheelById', () => {
            const carouselWrap = opts?.carouselWrap === true;

            const cur = get(boardState).items
                .slice()
                .sort((a, b) => a.order - b.order);

            const n = cur.length;
            if (n < 2) return;

            const from = cur.findIndex((x) => x.id === id);
            if (from < 0) {
                dbg.warn('moveWheelById.notFound', { id, reason });
                return;
            }

            let to = from + dir;

            // wrap logic
            if (to < 0) {
                to = carouselWrap ? Math.max(0, n - 2) : n - 1;
            } else if (to >= n) {
                to = carouselWrap ? Math.min(n - 1, 1) : 0;
            }

            if (to === from) {
                dbg.log('moveWheelById.noop', { id, from, to, dir, carouselWrap, reason });
                return;
            }

            const a = cur[from];
            const b = cur[to];

            const next = cur.slice();
            next[from] = { ...a, order: b.order };
            next[to] = { ...b, order: a.order };

            dbg.log('moveWheelById.move', { id, from, to, dir, carouselWrap, reason });

            setItems(next, reason);
        });
    }
};
