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

type SpokeKey = 'E' | 'ENE' | 'NE' | 'NNE' | 'N' | 'NNW' | 'NW' | 'WNW' |
                'W' | 'WSW' | 'SW' | 'SSW' | 'S' | 'SSE' | 'SE' | 'ESE' | 'E_next';

export const SPOKE_DESC: Record<CycleKind, Record<SpokeKey, string>> = {
    day: {
        E:   'Sunrise',

        ENE: 'Late Morning',
        NE:  'Noon Begin',
        NNE: 'Early Day',

        N: 'Midday',

        NNW: 'Late Day',
        NW:  'Evening Begin',
        WNW: 'Early Evening',

        W: 'Sunset',

        WSW: 'Late Evening',
        SW:  'Night Begin',
        SSW: 'Early Night',

        S: 'Midnight',

        SSE: 'Late Night',
        SE:  'Morning Begin',
        ESE: 'Early Morning',

        E_next: 'Next Sunrise'
    },
    moon: {
        E:  'First Quarter',

        ENE: 'Late Waxing',
        NE:  'Waxing Gibbous Begin',
        NNE: 'Early Waxing Gibbous',

        N:  'Full Moon',

        NNW: 'Late Waning Gibbous',
        NW:  'Waning Begin',
        WNW: 'Early Waning',

        W:  'Last Quarter',

        WSW: 'Late Waning',
        SW:  'New Moon Begin',
        SSW: 'Early New Moon',

        S:  'New Moon',

        SSE: 'Late New Moon',
        SE:  'Waxing Begin',
        ESE: 'Early Waxing',

        E_next: 'Next First Quarter'
    },
    year: {
        E: 'March Equinox',

        ENE: '',
        NE: '',
        NNE: '',

        N: 'June Solstice',

        NNW: '',
        NW: '',
        WNW: '',

        W: 'September Equinox',

        WSW: '',
        SW: '',
        SSW: '',

        S: 'December Solstice',

        SSE: '',
        SE: '',
        ESE: '',

        'E_next': 'Next March Equinox'
    },
    plato:{
        E: '',

        ENE: '',
        NE: '',
        NNE: '',

        N: '',

        NNW: '',
        NW: '',
        WNW: '',

        W: '',

        WSW: '',
        SW: '',
        SSW: '',

        S: 'Galactic Center',

        SSE: '',
        SE: '',
        ESE: '',

        'E_next': 'Next E'
    },
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