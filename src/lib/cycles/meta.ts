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

type SpokeKey = 'E' | 'N' | 'W' | 'S' | 'E_next';

export const SPOKE_DESC: Record<CycleKind, Record<SpokeKey, string>> = {
    day:  { E: 'Sunrise', N: 'Midday', W: 'Sunset',  S: 'Midnight',   'E_next': 'Next Sunrise' },
    moon: { E: 'First Quarter', N: 'Full Moon', W: 'Last Quarter', S: 'New Moon', 'E_next': 'Next First Quarter' },
    year: { E: 'March Equinox', N: 'June Solstice', W: 'September Equinox', S: 'December Solstice', 'E_next': 'Next March Equinox' },
    plato:{ E: '(???)', N: '(???)', W: '(???)', S: 'Galactic Center', 'E_next': 'Next E' },
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