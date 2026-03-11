import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Denebola
const RA_DENEBOLA_DEG = hmsToDeg(11, 49, 3.6);
const DEC_DENEBOLA_DEG = dmsToDeg(1, 14, 34, 19.0);

export const Denebola = {
    id: 'ref:denebola',
    kind: 'reference',
    name: 'Denebola',
    description: 'Denebola (ICRF/J2000) — the tail star of Leo and a well-known bright marker near the ecliptic.',
    emoji: '★',
    meta: {
        color: '#f2f3ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DENEBOLA_DEG,
                dec: DEC_DENEBOLA_DEG
            }
        }
    }
} satisfies Obj;
