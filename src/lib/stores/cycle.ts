// src/lib/stores/cycle.ts
import { writable } from 'svelte/store';
export const CYCLE_KINDS = [ 'solarTropical', 'plato'] as const;

export type CycleKind = typeof CYCLE_KINDS[number];

export type CyclesState = {
    cycles: CycleKind[];
};

const LS_KEY = 'chrono-com.cycle.v1';

function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}

function isCycleKind(x: unknown): x is CycleKind {
    return typeof x === 'string' && CYCLE_KINDS.includes(x as CycleKind);
}

function normalizeCycles(input: unknown): CycleKind[] {
    if (!Array.isArray(input)) return [];
    const filtered = input.filter(isCycleKind);
    return uniq(filtered);
}

function loadState(): CyclesState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) throw new Error('empty');
        const parsed = JSON.parse(raw) as Partial<CyclesState>;
        return { cycles: normalizeCycles(parsed.cycles) };
    } catch {
        return { cycles: [] };
    }
}

function saveState(s: CyclesState) {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
}

const cyclesState = writable<CyclesState>(loadState());
cyclesState.subscribe(saveState);
