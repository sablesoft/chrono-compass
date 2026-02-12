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

export type BoardWheelItem = {
    kind: 'wheel';

    wheelId: string;

    wheelType: WheelType;
    title: string;
    roles: WheelRolesState;

    observer: WheelObserverState;
    time: WheelTimeState;

    order: number;
    size?: number;
};

export type BoardState = {
    items: BoardWheelItem[];
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

function normalizeOrder(items: BoardWheelItem[]): BoardWheelItem[] {
    return items
        .slice()
        .sort((a: BoardWheelItem, b: BoardWheelItem) => a.order - b.order)
        .map((x: BoardWheelItem, i: number) => ({ ...x, order: i }));
}

function defaultCompassItem(order: number): BoardWheelItem {
    const wheelType: WheelType = 'compass';
    const roles: WheelRolesState = { looker: 'Earth', focus: null, target: ['Moon', 'Sun'] } as any;
    const observer: WheelObserverState = { ...DEFAULT_OBSERVER };
    const time: WheelTimeState = { ...DEFAULT_TIME };

    return {
        kind: 'wheel',
        wheelId: makeWheelId(wheelType, roles, observer, time),
        wheelType,
        title: 'Compass',
        roles,
        observer,
        time,
        order
    };
}

function ensureCompass(items: BoardWheelItem[], reason: string): BoardWheelItem[] {
    if (items.some((x: BoardWheelItem) => x.wheelType === 'compass')) return items;

    dbg.warn('board.ensureCompass.inject', { reason });
    return [...items, defaultCompassItem(items.length)];
}

function normalizeBoard(input: any): BoardState {
    return dbg.group('board.normalize', () => {
        const t = now();
        const itemsRaw: any[] = Array.isArray(input?.items) ? input.items : [];

        const parsedItems: BoardWheelItem[] = itemsRaw
            .filter((x: any) => x && x.kind === 'wheel' && typeof x.wheelType === 'string')
            .map((x: any, i: number): BoardWheelItem => {
                const wheelType = x.wheelType as WheelType;

                const roles: WheelRolesState =
                    (x.roles && typeof x.roles === 'object') ? (x.roles as WheelRolesState) : ({} as WheelRolesState);

                const observer: WheelObserverState = normalizeWheelObserver(x.observer, DEFAULT_LOCATION_ID);
                const time: WheelTimeState = normalizeWheelTime(x.time);

                const wheelId = makeWheelId(wheelType, roles, observer, time);

                return {
                    kind: 'wheel',
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

        // order normalize
        let items = normalizeOrder(parsedItems);

        // 🔥 мгновенная дедупликация (первый по order выигрывает)
        items = dedupeWheelItemsById(items);
        items = normalizeOrder(items);

        // policy: always keep at least one compass
        items = ensureCompass(items, 'normalizeBoard');
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
        const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null;
        const parsed = safeParse<any>(raw, null);
        const state = normalizeBoard(parsed);

        if (!raw || !parsed?.items?.length) {
            dbg.warn('board.load.bootstrapDefault', { hasRaw: !!raw, count: state.items.length });
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
    $s.items
        .slice()
        .sort((a: BoardWheelItem, b: BoardWheelItem) => a.order - b.order)
);

function setItems(nextItems: BoardWheelItem[], reason: string) {
    boardState.update(() => {
        // normalize order + dedupe + compass policy
        let items = normalizeOrder(nextItems);
        items = dedupeWheelItemsById(items);
        items = normalizeOrder(items);

        items = ensureCompass(items, reason);
        items = normalizeOrder(items);

        const next: BoardState = { items, updatedAt: now() };
        dbg.log('board.setItems', { reason, count: next.items.length, updatedAt: next.updatedAt });
        return next;
    });
}

export const boardApi = {
    get(): BoardState {
        const s = get(boardState);
        dbg.log('boardApi.get', { count: s.items.length, updatedAt: s.updatedAt });
        return s;
    },

    getItems(): BoardWheelItem[] {
        const s = get(boardState);
        return s.items.slice().sort((a: BoardWheelItem, b: BoardWheelItem) => a.order - b.order);
    },

    removeWheelById(wheelId: string, reason = 'removeWheelById') {
        dbg.group('boardApi.removeWheelById', () => {
            const cur: BoardWheelItem[] = get(boardState).items;
            const next: BoardWheelItem[] = cur.filter((x: BoardWheelItem) => x.wheelId !== wheelId);

            dbg.log('removeWheelById', { wheelId, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    /**
     * Полная замена доски (используется "Загрузить доску из профиля").
     * Нормализует order, wheelId и гарантирует наличие компаса по текущей политике.
     */
    setFromSnapshot(items: Omit<BoardWheelItem, 'order'>[], reason = 'setFromSnapshot') {
        dbg.group('boardApi.setFromSnapshot', () => {
            dbg.log('in', { reason, count: items.length });

            const next: BoardWheelItem[] = items.map((x: Omit<BoardWheelItem, 'order'>, i: number): BoardWheelItem => {
                const wheelType = x.wheelType;
                const roles = x.roles ?? ({} as WheelRolesState);
                const observer = normalizeWheelObserver((x as any).observer, DEFAULT_LOCATION_ID);
                const time = normalizeWheelTime((x as any).time);
                const wheelId = makeWheelId(wheelType, roles, observer, time);

                return {
                    kind: 'wheel',
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

    /**
     * Upsert компаса (пока политика доски: компас должен существовать).
     * ВАЖНО: observer/time теперь тоже часть wheelId, поэтому тут они важны.
     * Если их не передали — используем дефолты (подписанный на глобальное).
     */
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
        dbg.group('boardApi.upsertCompass', () => {
            dbg.log('payload', payload);

            const cur = get(boardState).items.slice();

            const wheelType: WheelType = 'compass';
            const roles: WheelRolesState = payload.roles ?? ({} as WheelRolesState);

            const observer: WheelObserverState = normalizeWheelObserver(
                { ...(DEFAULT_OBSERVER as any), ...(payload.observer ?? {}) },
                DEFAULT_LOCATION_ID
            );

            const time: WheelTimeState = normalizeWheelTime(
                { ...(DEFAULT_TIME as any), ...(payload.time ?? {}) }
            );

            const wheelId = makeWheelId(wheelType, roles, observer, time);

            // ищем по wheelId (потому что по одному wheelType уже нельзя — компасов может стать несколько)
            const idx = cur.findIndex((x: BoardWheelItem) => x.kind === 'wheel' && x.wheelId === wheelId);

            const nextItem: BoardWheelItem = {
                kind: 'wheel',
                wheelId,
                wheelType,
                title: payload.title ?? 'Compass',
                roles,
                observer,
                time,
                order: idx >= 0 ? cur[idx].order : cur.length,
                size: payload.size ?? (idx >= 0 ? cur[idx].size : undefined)
            };

            if (idx >= 0) {
                cur[idx] = nextItem;
                dbg.log('updated', { reason, order: nextItem.order, wheelId });
            } else {
                cur.push(nextItem);
                dbg.log('created', { reason, order: nextItem.order, wheelId });
            }

            setItems(cur, reason);
        });
    },

    /**
     * Удаление всех колёс типа (ОСТОРОЖНО: сейчас по политике ensureCompass компас вернётся обратно).
     */
    removeWheelType(type: WheelType, reason = 'removeWheelType') {
        dbg.group('boardApi.removeWheelType', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x: BoardWheelItem) => x.wheelType !== type);
            dbg.log('remove', { type, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    reorder(nextWheelIds: string[], reason = 'reorder') {
        dbg.group('boardApi.reorder', () => {
            const cur = get(boardState).items.slice();
            const byId = new Map<string, BoardWheelItem>(cur.map((x: BoardWheelItem) => [x.wheelId, x]));
            const next: BoardWheelItem[] = [];

            for (const id of nextWheelIds) {
                const it = byId.get(id);
                if (it) next.push(it);
            }
            // хвост
            for (const it of cur) {
                if (!next.some((x: BoardWheelItem) => x.wheelId === it.wheelId)) next.push(it);
            }

            dbg.log('reorder', { reason, count: next.length, order: next.map((x: BoardWheelItem) => x.wheelId) });
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