import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Alnair
const RA_ALNAIR_DEG = hmsToDeg(22, 8, 13.9);
const DEC_ALNAIR_DEG = dmsToDeg(-1, 46, 57, 39.5);

export const Alnair = {
    id: 'ref:alnair',
    kind: 'reference',
    name: 'Alnair',
    description: 'Alnair (ICRF/J2000) — the brightest star in Grus and a notable southern star near the celestial south.',
    emoji: '★',
    meta: {
        color: '#d6e2ff',
        distancePc: 30.9692,
        apparentMagnitude: 1.73,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALNAIR_DEG,
                dec: DEC_ALNAIR_DEG
            }
        }
    }
} satisfies Obj;
