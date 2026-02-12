// src/lib/board/store.ts
import { writable, derived, get } from 'svelte/store';

import { debug } from '../debug';
import type { WheelType } from '../catalog';
import type { WheelRolesState } from '../wheel/control';

export type BoardWheelItem = {
    kind: 'wheel';
    wheelType: WheelType;
    title: string;
    roles: WheelRolesState;
    order: number;       // 0..n-1
    size?: number;       // future
};

export type BoardState = {
    items: BoardWheelItem[];
    updatedAt: number;
};

const dbg = debug('PROFILE', '👤');

const KEY = 'chrono:board';

function now(): number {
    return Date.now();
}

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function normalizeBoard(input: any): BoardState {
    return dbg.group('board.normalize', () => {
        const t = now();
        const itemsRaw = Array.isArray(input?.items) ? input.items : [];

        const items: BoardWheelItem[] = itemsRaw
            .filter((x: any) => x && x.kind === 'wheel' && typeof x.wheelType === 'string')
            .map((x: any, i: number): BoardWheelItem => ({
                kind: 'wheel',
                wheelType: x.wheelType as WheelType,
                title: typeof x.title === 'string' ? x.title : '',
                roles: (x.roles && typeof x.roles === 'object') ? x.roles : {},
                order: Number.isFinite(x.order) ? x.order : i,
                size: Number.isFinite(x.size) ? x.size : undefined
            }))
            .sort((a: BoardWheelItem, b: BoardWheelItem) => a.order - b.order)
            .map((x: BoardWheelItem, i: number): BoardWheelItem => ({
                ...x,
                order: i
            }));

        // ВАЖНО: по твоей идее "на доске всегда один компас" — мы гарантируем это дефолтом.
        // (в будущем, когда появится "закрыть компас", будет разрешено пусто — тогда уберёшь этот блок)
        if (!items.some(x => x.wheelType === 'compass')) {
            const defCompass: BoardWheelItem = {
                kind: 'wheel',
                wheelType: 'compass',
                title: 'Compass',
                roles: { looker: 'Earth', focus: null, target: ['Moon', 'Sun'] } as any,
                order: items.length,
            };
            items.push(defCompass);
            items.sort(
                (a: BoardWheelItem, b: BoardWheelItem) => a.order - b.order
            ).forEach((x: BoardWheelItem, i: number) => {
                x.order = i;
            });
            dbg.warn('board.normalize.injectDefaultCompass');
        }

        const out: BoardState = {
            items,
            updatedAt: Number.isFinite(input?.updatedAt) ? input.updatedAt : t
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

boardState.subscribe((s) => {
    saveBoard(s);
});

export const boardItems = derived(boardState, ($s) => $s.items.slice().sort((a, b) => a.order - b.order));

function setItems(nextItems: BoardWheelItem[], reason: string) {
    boardState.update((s) => {
        const items = nextItems
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((x, i) => ({ ...x, order: i }));

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
        return s.items.slice().sort((a, b) => a.order - b.order);
    },

    /**
     * Полная замена доски (используется "Загрузить доску из профиля").
     * Нормализует order и гарантирует наличие компаса по текущей политике.
     */
    setFromSnapshot(items: Omit<BoardWheelItem, 'order'>[], reason = 'setFromSnapshot') {
        dbg.group('boardApi.setFromSnapshot', () => {
            dbg.log('in', { reason, count: items.length });
            const next: BoardWheelItem[] = items.map((x, i) => ({ ...x, order: i }));
            setItems(normalizeBoard({ items: next, updatedAt: now() }).items, reason);
        });
    },

    /**
     * ГЛАВНОЕ: обновлять текущий компас на доске при любом Apply.
     * Это НЕ сохранение в профиль.
     */
    upsertCompass(payload: { title: string; roles: WheelRolesState; size?: number }, reason = 'upsertCompass') {
        dbg.group('boardApi.upsertCompass', () => {
            const cur = get(boardState).items.slice();
            const idx = cur.findIndex(x => x.kind === 'wheel' && x.wheelType === 'compass');

            const nextItem: BoardWheelItem = {
                kind: 'wheel',
                wheelType: 'compass',
                title: payload.title ?? 'Compass',
                roles: payload.roles ?? {},
                order: idx >= 0 ? cur[idx].order : cur.length,
                size: payload.size ?? (idx >= 0 ? cur[idx].size : undefined)
            };

            if (idx >= 0) {
                cur[idx] = nextItem;
                dbg.log('updated', { reason, order: nextItem.order });
            } else {
                cur.push(nextItem);
                dbg.log('created', { reason, order: nextItem.order });
            }

            setItems(cur, reason);
        });
    },

    /**
     * В будущем: кнопка закрыть компас => реально убрать из доски.
     * (сейчас можешь не вызывать, потому что normalizeBoard всё равно вернёт дефолтный компас)
     */
    removeWheelType(type: WheelType, reason = 'removeWheelType') {
        dbg.group('boardApi.removeWheelType', () => {
            const cur = get(boardState).items;
            const next = cur.filter(x => x.wheelType !== type);
            dbg.log('remove', { type, before: cur.length, after: next.length, reason });
            setItems(next, reason);
        });
    },

    reorder(nextWheelTypes: WheelType[], reason = 'reorder') {
        dbg.group('boardApi.reorder', () => {
            const cur = get(boardState).items.slice();
            const byType = new Map(cur.map(x => [x.wheelType, x]));
            const next: BoardWheelItem[] = [];

            for (const wt of nextWheelTypes) {
                const it = byType.get(wt);
                if (it) next.push(it);
            }
            // добавим “хвост” (если что-то забыли)
            for (const it of cur) {
                if (!next.some(x => x.wheelType === it.wheelType)) next.push(it);
            }

            dbg.log('reorder', { reason, count: next.length, order: next.map(x => x.wheelType) });
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