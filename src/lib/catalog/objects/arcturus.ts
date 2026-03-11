import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Arcturus
const RA_ARCTURUS_DEG = hmsToDeg(14, 15, 39.7);
const DEC_ARCTURUS_DEG = dmsToDeg(1, 19, 10, 56.7);

export const Arcturus = {
    id: 'ref:arcturus',
    kind: 'reference',
    name: 'Arcturus',
    description: 'Arcturus (ICRF/J2000) — the brightest star in Bootes and one of the most prominent orange stars in the sky.',
    emoji: '★',
    meta: {
        color: '#ffb47e',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ARCTURUS_DEG,
                dec: DEC_ARCTURUS_DEG
            }
        }
    }
} satisfies Obj;
