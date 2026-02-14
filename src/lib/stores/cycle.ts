// src/lib/stores/cycle.ts
import { writable, derived } from 'svelte/store';
export const CYCLE_KINDS = ['diurnal', 'lunarSynodic', 'lunarAnomalistic', 'lunarDraconic', 'solarTropical', 'solarAnomalistic', 'plato'] as const;

export type CycleKind = typeof CYCLE_KINDS[number];

export type CyclesState = {
    cycles: CycleKind[];
};

const LS_KEY = 'chrono-com.cycle.v1';

function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}

export function isCycleKind(x: unknown): x is CycleKind {
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

export const cyclesState = writable<CyclesState>(loadState());
cyclesState.subscribe(saveState);

// ───────────────── selectors ─────────────────

export const cycles = derived(cyclesState, s => s.cycles);

// ───────────────── actions ─────────────────

export function setCycles(cycles: CycleKind[]) {
    cyclesState.update(s => ({ ...s, cycles: normalizeCycles(cycles) }));
}

