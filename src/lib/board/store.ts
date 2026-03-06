// src/lib/board/store.ts
import { writable, derived, get } from 'svelte/store';
import { nanoid } from 'nanoid';

import { debug } from '../debug';
import { wheels, type WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

import type { WheelObserverState, WheelTimeState } from '../wheel/types';

import type { BoardWheel, BoardWheelView } from './types';
import { DEFAULT_LOCATION_ID } from '../location/types';
import { DEFAULT_TIME } from '../time/types';
import { momentTagChipId } from '../catalog/tags';
import {
    BOARD_DEFAULT_H,
    BOARD_DEFAULT_W,
    BOARD_GRID_COLUMNS,
    buildLayoutForIds,
    insertAtFirstFit,
    moveAndCompact,
    normalizeRect
} from './layoutEngine';

export type BoardState = {
    items: BoardWheel[];
    updatedAt: number;
};

const dbg = debug('board', '👤');
const KEY = 'chrono:board';
export const DEFAULT_WHEEL_CARD_SIZE = 560;

const DEFAULT_OBSERVER: WheelObserverState = { locationId: DEFAULT_LOCATION_ID, locked: false };
const DEFAULT_VIEW: BoardWheelView = {
    showVisual: true,
    showInfo: false,
    showPickers: false,
    infoChipOrder: [],
    infoChipSelected: [],
    infoChipLabels: {},
    infoConfig: undefined,
    compassInfoConfig: undefined
};

function defaultInfoChipSelectedForWheel(wheelType: WheelType): string[] {
    if (wheelType === 'compass' || wheelType === 'system' || wheelType === 'galaxy') {
        return ['pinned'];
    }
    const spec = (wheels as any)[wheelType] as { info?: Array<{ defaultLabel?: string; enabled?: boolean }> } | undefined;
    const defs = Array.isArray(spec?.info) ? spec?.info : [];
    const momentIds = defs
        .filter((row) => row?.enabled !== false)
        .map((row) => momentTagChipId(String(row?.defaultLabel ?? '').trim()))
        .filter((id) => id && id !== 'moment:');
    const base = ['spoke', 'begin', 'end', 'duration'];
    const out = new Set<string>([...momentIds, ...base]);
    return Array.from(out);
}

function normalizeInfoChipOrder(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of input) {
        if (typeof raw !== 'string') continue;
        const id = raw.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function normalizeInfoChipLabels(input: unknown): Record<string, string> {
    if (!input || typeof input !== 'object') return {};
    const src = input as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) {
        const id = String(k || '').trim();
        if (!id || typeof v !== 'string') continue;
        const label = v.trim();
        if (!label) continue;
        out[id] = label;
    }
    return out;
}

function normalizeWheelView(input: unknown, fallback?: BoardWheelView): BoardWheelView {
    const base = fallback ?? DEFAULT_VIEW;
    const src = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
    const showInfo = typeof src.showInfo === 'boolean'
        ? src.showInfo
        : (base.showInfo === true);
    const showPickers = typeof src.showPickers === 'boolean'
        ? src.showPickers
        : (base.showPickers === true);
    return {
        showVisual: src.showVisual !== false,
        showInfo,
        showPickers,
        infoChipOrder: normalizeInfoChipOrder(src.infoChipOrder ?? base.infoChipOrder),
        infoChipSelected: normalizeInfoChipOrder(src.infoChipSelected ?? base.infoChipSelected),
        infoChipLabels: normalizeInfoChipLabels(src.infoChipLabels ?? base.infoChipLabels),
        infoConfig: (src.infoConfig && typeof src.infoConfig === 'object')
            ? (src.infoConfig as BoardWheelView['infoConfig'])
            : base.infoConfig,
        compassInfoConfig: (src.compassInfoConfig && typeof src.compassInfoConfig === 'object')
            ? (src.compassInfoConfig as BoardWheelView['compassInfoConfig'])
            : base.compassInfoConfig
    };
}

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
                    size: Number.isFinite(x.size) ? (x.size as number) : DEFAULT_WHEEL_CARD_SIZE,
                    layout: normalizeRect((x as any).layout, BOARD_GRID_COLUMNS),
                    view: normalizeWheelView((x as any)?.view)
                };
            });

        // board can be empty; no default injections
        let items = normalizeOrder(parsedItems);
        items = dedupeWheelItemsById(items);
        items = normalizeOrder(items);
        {
            const ids = items.map((x) => x.id);
            const existing = new Map(items.map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)]));
            const packed = buildLayoutForIds(ids, existing, BOARD_GRID_COLUMNS);
            items = items.map((x) => ({ ...x, layout: packed.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS) }));
        }

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
    layout?: Partial<NonNullable<BoardWheel['layout']>>;
    view?: Partial<NonNullable<BoardWheel['view']>>;
};

function sortByLayoutThenOrder(items: BoardWheel[]): BoardWheel[] {
    return items.slice().sort((a, b) => {
        const ay = Number.isFinite(a.layout?.y) ? Number(a.layout?.y) : Number.MAX_SAFE_INTEGER;
        const by = Number.isFinite(b.layout?.y) ? Number(b.layout?.y) : Number.MAX_SAFE_INTEGER;
        if (ay !== by) return ay - by;
        const ax = Number.isFinite(a.layout?.x) ? Number(a.layout?.x) : Number.MAX_SAFE_INTEGER;
        const bx = Number.isFinite(b.layout?.x) ? Number(b.layout?.x) : Number.MAX_SAFE_INTEGER;
        if (ax !== bx) return ax - bx;
        return a.order - b.order;
    });
}

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
            view?: Partial<NonNullable<BoardWheel['view']>>;
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

            const baseView = normalizeWheelView({
                infoChipSelected: defaultInfoChipSelectedForWheel(wheelType)
            });
            const view = input.view
                ? normalizeWheelView({ ...baseView, ...(input.view as any) }, baseView)
                : baseView;

            const item: BoardWheel = {
                id,
                wheelType,
                title: (input.title ?? '').toString(),
                roles,
                observer,
                time,
                order,
                size: Number.isFinite(input.size) ? input.size : DEFAULT_WHEEL_CARD_SIZE,
                layout: undefined,
                view
            };

            cur.push(item);
            {
                const existing = new Map(
                    cur
                        .filter((x) => x.id !== id)
                        .map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)])
                );
                const withNew = insertAtFirstFit(existing, id, { w: BOARD_DEFAULT_W, h: BOARD_DEFAULT_H }, BOARD_GRID_COLUMNS);
                for (const x of cur) x.layout = withNew.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS);
            }

            dbg.log('boardApi.addWheel.ok', { id, wheelType, order, reason });
            setItems(cur, reason);
            return id;
        });
    },

    /**
     * Create a NEW wheel instance and insert it before another board wheel.
     * If beforeId is missing, appends to the end.
     */
    addWheelBefore(
        beforeId: string,
        input: {
            wheelType: WheelType;
            title?: string;
            roles?: WheelRolesState;
            observer?: WheelObserverState;
            time?: WheelTimeState;
            view?: Partial<NonNullable<BoardWheel['view']>>;
            size?: number;
        },
        reason = 'addWheelBefore'
    ): string {
        return dbg.group('boardApi.addWheelBefore', () => {
            const cur = get(boardState).items
                .slice()
                .sort((a, b) => a.order - b.order);

            const wheelType = input.wheelType;
            const roles = (input.roles ?? ({} as WheelRolesState)) as WheelRolesState;

            const observer = normalizeWheelObserver(input.observer ?? DEFAULT_OBSERVER, DEFAULT_LOCATION_ID);
            const time = normalizeWheelTime(input.time ?? DEFAULT_TIME);

            const id = nanoid();
            const baseView = normalizeWheelView({
                infoChipSelected: defaultInfoChipSelectedForWheel(wheelType)
            });
            const view = input.view
                ? normalizeWheelView({ ...baseView, ...(input.view as any) }, baseView)
                : baseView;

            const item: BoardWheel = {
                id,
                wheelType,
                title: (input.title ?? '').toString(),
                roles,
                observer,
                time,
                order: 0,
                size: Number.isFinite(input.size) ? input.size : DEFAULT_WHEEL_CARD_SIZE,
                layout: undefined,
                view
            };

            const at = cur.findIndex((x) => x.id === beforeId);
            const insertAt = at >= 0 ? at : cur.length;
            cur.splice(insertAt, 0, item);
            {
                const existing = new Map(
                    cur
                        .filter((x) => x.id !== id)
                        .map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)])
                );
                const withNew = insertAtFirstFit(existing, id, { w: BOARD_DEFAULT_W, h: BOARD_DEFAULT_H }, BOARD_GRID_COLUMNS);
                for (const x of cur) x.layout = withNew.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS);
            }

            const next = cur.map((x, i) => ({ ...x, order: i }));
            dbg.log('boardApi.addWheelBefore.ok', { id, wheelType, beforeId, insertAt, reason });
            setItems(next, reason);
            return id;
        });
    },

    removeWheelById(id: string, reason = 'removeWheelById') {
        dbg.group('boardApi.removeWheelById', () => {
            const cur = get(boardState).items;
            const next = cur.filter((x) => x.id !== id);

            const ordered = sortByLayoutThenOrder(next);
            const ids = ordered.map((x) => x.id);
            const packed = buildLayoutForIds(
                ids,
                new Map(next.map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)])),
                BOARD_GRID_COLUMNS
            );
            const packedNext = next.map((x) => ({
                ...x,
                layout: packed.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS)
            }));

            dbg.log('removeWheelById', { id, before: cur.length, after: next.length, reason });
            setItems(packedNext, reason);
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
            const layout = patch.layout
                ? normalizeRect({ ...(prev.layout ?? {}), ...(patch.layout as any) }, BOARD_GRID_COLUMNS)
                : prev.layout;
            const view = patch.view
                ? normalizeWheelView({ ...(prev.view ?? DEFAULT_VIEW), ...(patch.view as any) }, prev.view ?? DEFAULT_VIEW)
                : normalizeWheelView(prev.view ?? DEFAULT_VIEW);

            cur[idx] = {
                ...prev,
                wheelType,
                roles,
                observer,
                time,
                title,
                size,
                layout,
                view
            };

            if (patch.layout) {
                const ordered = sortByLayoutThenOrder(cur);
                const ids = ordered.map((x) => x.id);
                const packed = buildLayoutForIds(
                    ids,
                    new Map(cur.map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)])),
                    BOARD_GRID_COLUMNS
                );
                for (const x of cur) x.layout = packed.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS);
            }

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
                    size: Number.isFinite(x.size) ? x.size : DEFAULT_WHEEL_CARD_SIZE,
                    layout: normalizeRect((x as any).layout, BOARD_GRID_COLUMNS),
                    view: normalizeWheelView((x as any)?.view),
                    order: i
                };
            });

            setItems(normalizeBoard({ items: next, updatedAt: now() }).items, reason);
        });
    },

    moveWheelById(id: string, dir: -1 | 1, _opts?: { carouselWrap?: boolean }, reason = 'moveWheelById') {
        dbg.group('boardApi.moveWheelById', () => {
            const cur = get(boardState).items
                .slice()
                .sort((a, b) => a.order - b.order);

            const n = cur.length;
            if (n < 2) return;

            const visual = cur
                .slice()
                .sort((a, b) => {
                    const ay = Number.isFinite(a.layout?.y) ? Number(a.layout?.y) : Number.MAX_SAFE_INTEGER;
                    const by = Number.isFinite(b.layout?.y) ? Number(b.layout?.y) : Number.MAX_SAFE_INTEGER;
                    if (ay !== by) return ay - by;
                    const ax = Number.isFinite(a.layout?.x) ? Number(a.layout?.x) : Number.MAX_SAFE_INTEGER;
                    const bx = Number.isFinite(b.layout?.x) ? Number(b.layout?.x) : Number.MAX_SAFE_INTEGER;
                    if (ax !== bx) return ax - bx;
                    return a.order - b.order;
                });

            const from = visual.findIndex((x) => x.id === id);
            if (from < 0 || !visual[from]) {
                dbg.warn('moveWheelById.notFound', { id, reason });
                return;
            }

            let to = from + dir;
            if (to < 0) to = n - 1;
            else if (to >= n) to = 0;

            if (to === from) {
                dbg.log('moveWheelById.noop', { id, from, to, dir, reason });
                return;
            }

            const fromItem = visual[from];
            const toItem = visual[to];
            const fromRect = normalizeRect(fromItem.layout, BOARD_GRID_COLUMNS);
            const toRect = normalizeRect(toItem.layout, BOARD_GRID_COLUMNS);

            const next = cur.map((x) => {
                if (x.id === fromItem.id) return { ...x, layout: toRect };
                if (x.id === toItem.id) return { ...x, layout: fromRect };
                return x;
            });

            const order = visual.map((x) => x.id);
            const packed = buildLayoutForIds(
                order,
                new Map(next.map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)])),
                BOARD_GRID_COLUMNS
            );

            const packedNext = next.map((x) => ({ ...x, layout: packed.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS) }));

            dbg.log('moveWheelById.moveByLayout', { id, from, to, dir, reason });
            setItems(packedNext, reason);
        });
    },

    moveWheelLayoutTo(id: string, patch: Partial<BoardWheel['layout']>, reason = 'moveWheelLayoutTo') {
        dbg.group('boardApi.moveWheelLayoutTo', () => {
            const cur = get(boardState).items.slice();
            const idx = cur.findIndex((x) => x.id === id);
            if (idx < 0) return;

            const order = cur.map((x) => x.id);
            const existing = new Map(cur.map((x) => [x.id, normalizeRect(x.layout, BOARD_GRID_COLUMNS)]));
            const nextMap = moveAndCompact(existing, id, patch as any, order, BOARD_GRID_COLUMNS);

            const next = cur.map((x) => ({ ...x, layout: nextMap.get(x.id) ?? normalizeRect(x.layout, BOARD_GRID_COLUMNS) }));
            setItems(next, reason);
        });
    },

    swapWheelLayoutById(aId: string, bId: string, reason = 'swapWheelLayoutById') {
        dbg.group('boardApi.swapWheelLayoutById', () => {
            if (!aId || !bId || aId === bId) return;
            const cur = get(boardState).items.slice();
            const a = cur.find((x) => x.id === aId);
            const b = cur.find((x) => x.id === bId);
            if (!a || !b) return;

            const aRect = normalizeRect(a.layout, BOARD_GRID_COLUMNS);
            const bRect = normalizeRect(b.layout, BOARD_GRID_COLUMNS);

            const next = cur.map((x) => {
                if (x.id === aId) return { ...x, layout: bRect };
                if (x.id === bId) return { ...x, layout: aRect };
                return x;
            });

            setItems(next, reason);
        });
    }
};
