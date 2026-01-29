// src/lib/cycles/meta.ts
import type { CycleKind } from './types';

export type CycleMeta = {
    label: string;
    title?: string;
    description?: string;
    order: number;
};

export type CycleOption = {
    kind: CycleKind;
    label: string;
    title?: string;
    disabled?: boolean;
};

export const CYCLE_META: Record<CycleKind, CycleMeta> = {
    day:   { label: 'Day',  description: 'Diurnal Cycle',  order: 10 },
    moon:  { label: 'Moon', description: 'Synodic Cycle', order: 20 },
    year:  { label: 'Year', description: 'Solar Cycle', order: 30 },
    plato: { label: 'Plato',description: 'Precession Cycle', order: 40 },
};

export function getCycleLabel(kind: CycleKind, _locale?: string) {
    // позже тут можно сделать switch по locale / подключить i18n
    return CYCLE_META[kind].label;
}

export function getCycleTitle(kind: CycleKind) {
    const m = CYCLE_META[kind];
    return m.description
        ? `${m.label} — ${m.description}`
        : m.label;
}

export function getCycleOptions(kinds?: CycleKind[]): CycleOption[] {
    const list = (kinds ?? (Object.keys(CYCLE_META) as CycleKind[]))
        .slice()
        .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);

    return list.map((kind): CycleOption => ({
        kind,
        label: getCycleLabel(kind),
        title: CYCLE_META[kind].title ?? getCycleLabel(kind),
        // disabled не задаём — он опционален
    }));
}