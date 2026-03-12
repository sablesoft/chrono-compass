import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Avior
const RA_AVIOR_DEG = hmsToDeg(8, 22, 30.8);
const DEC_AVIOR_DEG = dmsToDeg(-1, 59, 30, 35.0);

export const Avior = {
    id: 'ref:avior',
    kind: 'reference',
    name: 'Avior',
    description: 'Avior (ICRF/J2000) — a bright southern star in Carina, widely recognized in navigational traditions.',
    emoji: '✦',
    meta: {
        color: '#ffe0b5',
        distancePc: 185.5287,
        apparentMagnitude: 1.86,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_AVIOR_DEG,
                dec: DEC_AVIOR_DEG
            }
        }
    }
} satisfies Obj;
