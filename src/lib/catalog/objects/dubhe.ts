import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Dubhe
const RA_DUBHE_DEG = hmsToDeg(11, 3, 43.7);
const DEC_DUBHE_DEG = dmsToDeg(1, 61, 45, 3.7);

export const Dubhe = {
    id: 'ref:dubhe',
    kind: 'reference',
    name: 'Dubhe',
    description: 'Dubhe (ICRF/J2000) — one of the pointer stars of Ursa Major and a familiar guide toward the north.',
    emoji: '★',
    meta: {
        color: '#ffd7ab',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DUBHE_DEG,
                dec: DEC_DUBHE_DEG
            }
        }
    }
} satisfies Obj;
