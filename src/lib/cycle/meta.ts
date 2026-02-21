// src/lib/cycle/meta.ts
import type { CycleKind } from '../stores/cycle';
import type {SpokeKey} from "../wheel/types";

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
    diurnal:   {
        label: 'Earth Horizon: Sun',
        description: 'Day Cycle',
        order: 10
    },
    lunarSynodic:  {
        label: 'Sun Synod: Earth - Moon',
        description: 'Moon Phases',
        order: 20
    },
    lunarDraconic: {
        label: ' Earth Nodal: Moon',
        description: 'Draconic',
        order: 25
    },
    lunarAnomalistic: {
        label: 'Earth Bind: Moon',
        description: 'Moon Orbit',
        order: 30
    },
    solarTropical:  {
        label: 'Solar Season: Earth',
        description: 'Tropical Year',
        order: 40
    },
    solarAnomalistic: {
        label: 'Solar Bind: Earth',
        description: 'Earth Orbit',
        order: 45
    },
    plato: {
        label: 'Galaxy Plato: Earth',
        description: 'Precession Cycle',
        order: 50
    },
};

export const SPOKE_DESC: Record<CycleKind, Record<SpokeKey, string>> = {
    diurnal: {
        E:   'Sunrise',

        ENE: 'Late Morning',
        NE:  'Day Begin',
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
    lunarSynodic: {
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
    lunarDraconic: {
        E:  'Caput Draconis',          // Голова Дракона (Восходящий узел)

        ENE: 'Ascent',
        NE:  'Ascending',
        NNE: 'Rising',

        N:  'Summit',    // условно: высота пути

        NNW: 'Turning',
        NW:  'Descending',
        WNW: 'Approach to the Tail',

        W:  'Cauda Draconis',          // Хвост Дракона (Нисходящий узел)

        WSW: 'Retreat',
        SW:  'Below',
        SSW: 'Depth',

        S:  'Nadir',     // условно: нижняя точка пути

        SSE: 'Returning',
        SE:  'Re-emerging',
        ESE: 'Approach to the Head',

        E_next: 'Caput Draconis (Next)'
    },
    lunarAnomalistic: {
        E:   'Approaching Apogee',

        ENE: 'Distance Increasing',
        NE:  'Farther (toward Apogee)',
        NNE: 'Near Apogee',

        N:   'Apogee',

        NNW: 'Leaving Apogee',
        NW:  'Distance Decreasing',
        WNW: 'Closer (toward Perigee)',

        W:   'Approaching Perigee',

        WSW: 'Distance Decreasing',
        SW:  'Closer (toward Perigee)',
        SSW: 'Near Perigee',

        S:   'Perigee',

        SSE: 'Leaving Perigee',
        SE:  'Distance Increasing',
        ESE: 'Farther (toward Apogee)',

        E_next: 'Next Cycle Start'
    },
    solarTropical: {
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
    solarAnomalistic: {
        E: 'Per → Aph',

        ENE: '',
        NE: '',
        NNE: '',

        N: 'Aphelion',

        NNW: '',
        NW: '',
        WNW: '',

        W: 'Aph → Per',

        WSW: '',
        SW: '',
        SSW: '',

        S: 'Perihelion',

        SSE: '',
        SE: '',
        ESE: '',

        E_next: 'Next Midpoint (Per → Aph)'
    },
    plato: {
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