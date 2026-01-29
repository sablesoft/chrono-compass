// src/lib/cycles/meta.ts
import type { CycleKind } from './types';

export type CycleMeta = {
    label: string;
    title?: string;
    order: number;
};

export type CycleOption = {
    kind: CycleKind;
    label: string;
    title?: string;
    disabled?: boolean;
};

export const CYCLE_META: Record<CycleKind, CycleMeta> = {
    day:   { label: 'Day',   order: 10 },
    moon:  { label: 'Moon',  order: 20 },
    year:  { label: 'Year',  order: 30 },
    plato: { label: 'Plato', order: 40 },
};

export function getCycleLabel(kind: CycleKind, _locale?: string) {
    // позже тут можно сделать switch по locale / подключить i18n
    return CYCLE_META[kind].label;
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