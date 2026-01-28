import type {CycleKind} from "./types";

type SpokeKey = 'E' | 'N' | 'W' | 'S' | 'E_next';

export const SPOKE_DESC: Record<CycleKind, Record<SpokeKey, string>> = {
    day:  { E: 'Sunrise', N: 'Midday', W: 'Sunset',  S: 'Midnight',   'E_next': 'Next Sunrise' },
    moon: { E: 'First Quarter', N: 'Full Moon', W: 'Last Quarter', S: 'New Moon', 'E_next': 'Next First Quarter' },
    year: { E: 'March Equinox', N: 'June Solstice', W: 'September Equinox', S: 'December Solstice', 'E_next': 'Next March Equinox' },
    plato:{ E: 'E (???)', N: 'N (???)', W: 'W (???)', S: 'Galactic Center', 'E_next': 'Next E' },
};