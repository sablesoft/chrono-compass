import type {CycleKind} from "./types";

type SpokeKey = 'E' | 'N' | 'W' | 'S' | 'E_next';

export const SPOKE_DESC: Record<CycleKind, Record<SpokeKey, string>> = {
    day:  { E: 'Sunrise', N: 'Midday', W: 'Sunset',  S: 'Midnight',   'E_next': 'Next sunrise' },
    moon: { E: 'First quarter', N: 'Full moon', W: 'Last quarter', S: 'New moon', 'E_next': 'Next first quarter' },
    year: { E: 'March equinox', N: 'June solstice', W: 'September equinox', S: 'December solstice', 'E_next': 'Next March equinox' },
    plato:{ E: 'E (custom)', N: 'N (custom)', W: 'W (custom)', S: 'Galactic Center (S)', 'E_next': 'Next E' },
};