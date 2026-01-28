import { writable, derived, get } from 'svelte/store';

export type Collection = {
    id: string;
    name: string;
    markerBg: string;        // цвет фона “значка”
    orbit: number;           // 0..1 (доля между inner..outer радиусом)
};

export type Moment = {
    id: string;
    ts: number;              // unix ms (нормализованный до минуты)
    collectionId: string;
    title: string;
    description: string;
    emoji: string;           // пока просто emoji
    updatedAt: number;
    createdAt: number;
};

type State = {
    collections: Collection[];
    moments: Moment[];
    // “текущая коллекция” для UX: куда по умолчанию сохраняем
    currentCollectionId: string | null;
    // мультиселект отображения (позже UI), пока можно хранить
    visibleCollectionIds: string[];
};

const LS_KEY = 'chronocompass:moments:v1';

function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function normalizeTsMinute(ts: number) {
    return Math.floor(ts / 60_000) * 60_000;
}

function loadState(): State {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) throw new Error('empty');
        const parsed = JSON.parse(raw) as State;
        if (!parsed.collections?.length) throw new Error('bad');
        return parsed;
    } catch {
        const defaultCol: Collection = {
            id: uid('col'),
            name: 'My Moments',
            markerBg: 'rgba(231,231,234,0.18)',
            orbit: 0.90,
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
export const moment = derived(momentsState, s => s.moments);
export const currentCollectionId = derived(momentsState, s => s.currentCollectionId);
export const visibleCollectionIds = derived(momentsState, s => s.visibleCollectionIds);

export function setCurrentCollection(id: string) {
    momentsState.update(s => ({ ...s, currentCollectionId: id }));
}

export function createCollection(name: string) {
    const col: Collection = {
        id: uid('col'),
        name: name.trim() || 'Untitled',
        markerBg: 'rgba(231,231,234,0.18)',
        orbit: 0.90,
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

export function findMomentInCollectionByTs(collectionId: string, ts: number) {
    const tsN = normalizeTsMinute(ts);
    const s = get(momentsState);
    return s.moments.find(m => m.collectionId === collectionId && m.ts === tsN) ?? null;
}

export function upsertMoment(input: {
    id?: string;
    ts: number;
    collectionId: string;
    title: string;
    description: string;
    emoji: string;
}) {
    const now = Date.now();
    const tsN = normalizeTsMinute(input.ts);

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
            createdAt: now,
            updatedAt: now,
        };
        return { ...s, moments: [m, ...s.moments], currentCollectionId: input.collectionId };
    });
}

export function deleteMoment(id: string) {
    momentsState.update(s => ({ ...s, moments: s.moments.filter(m => m.id !== id) }));
}
