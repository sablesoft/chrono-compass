import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Menkar
const RA_MENKAR_DEG = hmsToDeg(3, 2, 16.8);
const DEC_MENKAR_DEG = dmsToDeg(1, 4, 5, 23.0);

export const Menkar = {
    id: 'ref:menkar',
    kind: 'reference',
    name: 'Menkar',
    description: 'Menkar (ICRF/J2000) — a red giant in Cetus traditionally associated with the sea monster’s head.',
    emoji: '★',
    meta: {
        color: '#ffb27c',
        distanceLy: 249.164,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MENKAR_DEG,
                dec: DEC_MENKAR_DEG
            }
        }
    }
} satisfies Obj;
