// src/lib/catalog/objects/nunki.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Nunki (Sigma Sagittarii)
const RA_NUNKI_DEG = hmsToDeg(18, 55, 15);
const DEC_NUNKI_DEG = dmsToDeg(-1, 26, 17, 48);

export const Nunki = {
    id: 'ref:nunki',
    kind: 'reference',
    name: 'Nunki',
    description: 'Nunki (ICRF/J2000) — the formal name of Sigma Sagittarii and one of the brightest stars in Sagittarius near the Milky Way.',
    emoji: '★',
    meta: {
        color: '#aabfff',
        distancePc: 69.8325,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_NUNKI_DEG,
                dec: DEC_NUNKI_DEG
            }
        }
    }
} satisfies Obj;
