// src/lib/stores/cycle.ts
import { writable, derived, get } from 'svelte/store';
import {CYCLE_KINDS, type CycleKind} from '../cycles/types';

export type CyclesState = {
    cycles: CycleKind[];
};

const LS_KEY = 'chrono-com.cycle.v1';

// дефолт: показываем всё, кроме больших циклов (> года)
export const DEFAULT_CYCLES: CycleKind[] = ['day', 'moon', 'year'];

function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}

export function isCycleKind(x: unknown): x is CycleKind {
    return typeof x === 'string' && CYCLE_KINDS.includes(x as CycleKind);
}

function normalizeCycles(input: unknown): CycleKind[] {
    if (!Array.isArray(input)) return DEFAULT_CYCLES.slice();
    const filtered = input.filter(isCycleKind);
    const unique = uniq(filtered);
    return unique.length ? unique : DEFAULT_CYCLES.slice();
}

function loadState(): CyclesState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) throw new Error('empty');
        const parsed = JSON.parse(raw) as Partial<CyclesState>;
        return { cycles: normalizeCycles(parsed.cycles) };
    } catch {
        return { cycles: DEFAULT_CYCLES.slice() };
    }
}

function saveState(s: CyclesState) {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export const cyclesState = writable<CyclesState>(loadState());
cyclesState.subscribe(saveState);

// ───────────────── selectors ─────────────────

export const cycles = derived(cyclesState, s => s.cycles);
export const cycleSet = derived(cycles, arr => new Set(arr));

// ───────────────── actions ─────────────────

export function setCycles(cycles: CycleKind[]) {
    cyclesState.update(s => ({ ...s, cycles: normalizeCycles(cycles) }));
}

export function setOnlyCycle(kind: CycleKind) {
    setCycles([kind]);
}

export function addCycle(kind: CycleKind) {
    cyclesState.update(s => ({
        ...s,
        cycles: normalizeCycles([...s.cycles, kind]),
    }));
}

export function removeCycle(kind: CycleKind) {
    cyclesState.update(s => ({
        ...s,
        cycles: normalizeCycles(s.cycles.filter(k => k !== kind)),
    }));
}

export function toggleCycle(kind: CycleKind) {
    cyclesState.update(s => {
        const has = s.cycles.includes(kind);
        return {
            ...s,
            cycles: normalizeCycles(
                has ? s.cycles.filter(k => k !== kind) : [...s.cycles, kind]
            ),
        };
    });
}

export function isCycleEnabled(kind: CycleKind) {
    return get(cyclesState).cycles.includes(kind);
}

export function resetCycles() {
    setCycles(DEFAULT_CYCLES.slice());
}
