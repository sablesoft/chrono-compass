import { writable, derived, get } from 'svelte/store';
import type {CycleKind} from "../cycles/types";
import { getCycleOptions } from '../cycles/meta';

export type Collection = {
    id: string;
    name: string;
    markerBg: string;        // цвет фона “значка”
    emoji: string;
    orbit: number;           // 0..1 (доля между inner..outer радиусом)
    enabled: boolean;
};

export type Moment = {
    id: string;
    ts: number;
    collectionId: string;
    title: string;
    description: string;
    cycles: CycleKind[];
    emoji: string;
    repeat?: RepeatRule;     // <-- NEW: если есть, то это “периодический момент”
    updatedAt: number;
    createdAt: number;
};

export type RepeatUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export type OnDayMode = 'same' | 'clamp' | 'last';

export type RepeatEnd =
    | { mode: 'never' }
    | { mode: 'until'; untilTs: number }       // inclusive/whatever — решим в генераторе
    | { mode: 'count'; count: number };        // всего N повторов включая старт

export type RepeatRule = {
    every: number;           // 1..999
    unit: RepeatUnit;
    onDay: OnDayMode;        // используется в month/year, в остальных игнорится
    end: RepeatEnd;
};

type State = {
    collections: Collection[];
    moments: Moment[];
    // “текущая коллекция” для UX: куда по умолчанию сохраняем
    currentCollectionId: string | null;
    // мультиселект отображения (позже UI), пока можно хранить
    visibleCollectionIds: string[];
};

const LS_KEY = 'chrono-com.moment.v1';

function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function normalizeTsMinute(ts: number) {
    return Math.floor(ts / 60_000) * 60_000;
}

function isCycleKind(x: unknown): x is CycleKind {
    // быстро и без хардкода: проверяем по опциям
    return getCycleOptions().some(o => o.kind === x);
}

function defaultMomentCycles(): CycleKind[] {
    const opts = getCycleOptions().filter(o => !o.disabled).map(o => o.kind);
    if (opts.length <= 1) return opts;
    return opts.slice(0, -1); // всё кроме “самого большого”
}

function normalizeMomentCycles(input: unknown): CycleKind[] {
    if (!Array.isArray(input)) return defaultMomentCycles();
    const arr = input.filter(isCycleKind);
    const uniq = Array.from(new Set(arr));
    return uniq.length ? uniq : defaultMomentCycles();
}

function loadState(): State {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) throw new Error('Empty state');
        const parsed = JSON.parse(raw) as State;
        if (!parsed.collections?.length) throw new Error('Empty collections list');
        return parsed;
    } catch {
        const defaultCol: Collection = {
            id: uid('col'),
            name: 'My Moments',
            emoji: '📍',
            markerBg: 'var(--accent-live)',
            orbit: 0.75,
            enabled: true
        };

        return {
            collections: [defaultCol],
            moments: [],
            currentCollectionId: defaultCol.id,
            visibleCollectionIds: [defaultCol.id],
        };
    }
}

function saveState(s: State) {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export const momentsState = writable<State>(loadState());
momentsState.subscribe(saveState);

export const collections = derived(momentsState, s => s.collections);
export const moments = derived(momentsState, s => s.moments);
export const currentCollectionId = derived(momentsState, s => s.currentCollectionId);
export const visibleCollectionIds = derived(momentsState, s => s.visibleCollectionIds);

export function setCurrentCollection(id: string) {
    momentsState.update(s => ({ ...s, currentCollectionId: id }));
}

export function createCollection(name: string) {
    const col: Collection = {
        id: uid('col'),
        name: name.trim() || 'Untitled',
        emoji: '📍',
        markerBg: 'var(--accent-live)',
        orbit: 0.75,
        enabled: true
    };
    momentsState.update(s => ({
        ...s,
        collections: [col, ...s.collections],
        currentCollectionId: col.id,
        visibleCollectionIds: Array.from(new Set([col.id, ...s.visibleCollectionIds])),
    }));
    return col.id;
}

export function updateCollection(id: string, patch: Partial<Pick<Collection, 'name'|'markerBg'|'orbit'>>) {
    momentsState.update(s => ({
        ...s,
        collections: s.collections.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
}

export function deleteCollection(id: string) {
    momentsState.update(s => {
        const collections2 = s.collections.filter(c => c.id !== id);
        const moments2 = s.moments.filter(m => m.collectionId !== id);

        const fallback = collections2[0]?.id ?? null;
        const currentCollectionId =
            s.currentCollectionId === id ? fallback : s.currentCollectionId;

        const visibleCollectionIds = s.visibleCollectionIds.filter(x => x !== id);

        return { ...s, collections: collections2, moments: moments2, currentCollectionId, visibleCollectionIds };
    });
}

export function findMomentInCollectionByTsFromState(
    s: { moments: any[] },
    collectionId: string,
    ts: number
) {
    const tsN = normalizeTsMinute(ts);
    return s.moments.find(m => m.collectionId === collectionId && m.ts === tsN) ?? null;
}

function sanitizeRepeat(r?: RepeatRule): RepeatRule | undefined {
    if (!r) return undefined;

    const every = Math.max(1, Math.min(999, Math.floor(r.every || 1)));
    const unit = r.unit;
    const onDay: OnDayMode = r.onDay ?? 'clamp';

    let end: RepeatEnd = r.end ?? { mode: 'never' };

    if (end.mode === 'count') {
        const count = Math.max(1, Math.min(9999, Math.floor((end as any).count || 1)));
        end = { mode: 'count', count };
    } else if (end.mode === 'until') {
        const untilTsRaw = (end as any).untilTs;
        if (typeof untilTsRaw !== 'number' || !Number.isFinite(untilTsRaw)) {
            end = { mode: 'never' };
        } else {
            end = { mode: 'until', untilTs: normalizeTsMinute(untilTsRaw) };
        }
    } else {
        end = { mode: 'never' };
    }

    return { every, unit, onDay, end };
}

export function upsertMoment(input: {
    id?: string;
    ts: number;
    collectionId: string;
    title: string;
    description: string;
    emoji: string;
    cycles?: CycleKind[];
    repeat?: RepeatRule; // <-- NEW
}) {
    const now = Date.now();
    const tsN = normalizeTsMinute(input.ts);
    const cyclesN = normalizeMomentCycles(input.cycles);
    const repeat = sanitizeRepeat(input.repeat);

    momentsState.update(s => {
        const existing = input.id ? s.moments.find(m => m.id === input.id) : null;

        if (existing) {
            const moments2 = s.moments.map(m =>
                m.id === existing.id
                    ? {
                        ...m,
                        ts: tsN,
                        collectionId: input.collectionId,
                        title: input.title.trim(),
                        description: input.description.trim(),
                        emoji: input.emoji || '📍',
                        cycles: cyclesN,
                        repeat,
                        updatedAt: now,
                    }
                    : m
            );
            return { ...s, moments: moments2, currentCollectionId: input.collectionId };
        }

        // защита от дубля в рамках коллекции по минуте
        const dup = s.moments.find(m => m.collectionId === input.collectionId && m.ts === tsN);
        if (dup) {
            const moments2 = s.moments.map(m =>
                m.id === dup.id
                    ? {
                        ...m,
                        title: input.title.trim(),
                        description: input.description.trim(),
                        emoji: input.emoji || '📍',
                        cycles: cyclesN,
                        repeat,
                        updatedAt: now,
                    }
                    : m
            );
            return { ...s, moments: moments2, currentCollectionId: input.collectionId };
        }

        const m: Moment = {
            id: uid('m'),
            ts: tsN,
            collectionId: input.collectionId,
            title: input.title.trim(),
            description: input.description.trim(),
            emoji: input.emoji || '📍',
            repeat,
            cycles: cyclesN,
            createdAt: now,
            updatedAt: now,
        };
        return { ...s, moments: [m, ...s.moments], currentCollectionId: input.collectionId };
    });
}

export function deleteMoment(id: string) {
    momentsState.update(s => ({ ...s, moments: s.moments.filter(m => m.id !== id) }));
}
