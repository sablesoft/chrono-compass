import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Capella
const RA_CAPELLA_DEG = hmsToDeg(5, 16, 41.36);
const DEC_CAPELLA_DEG = dmsToDeg(1, 45, 59, 52.8);

export const Capella = {
    id: 'ref:capella',
    kind: 'reference',
    name: 'Capella',
    description: 'Capella (ICRF/J2000) — the brightest star in Auriga and one of the most prominent golden stars of the northern sky.',
    emoji: '★',
    meta: {
        color: '#ffd68e',
        distancePc: 13.1235,
        apparentMagnitude: 0.08,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CAPELLA_DEG,
                dec: DEC_CAPELLA_DEG
            }
        }
    }
} satisfies Obj;
