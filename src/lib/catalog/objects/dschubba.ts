import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Dschubba
const RA_DSCHUBBA_DEG = hmsToDeg(16, 0, 20.0);
const DEC_DSCHUBBA_DEG = dmsToDeg(-1, 22, 37, 18.0);

export const Dschubba = {
    id: 'ref:dschubba',
    kind: 'reference',
    name: 'Dschubba',
    description: 'Dschubba (ICRF/J2000) — Delta Scorpii, a prominent star in the Scorpion’s forehead and one of the best-known stars of upper Scorpius.',
    emoji: '★',
    meta: {
        color: '#d8e5ff',
        distancePc: 150.6025,
        apparentMagnitude: 2.29,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DSCHUBBA_DEG,
                dec: DEC_DSCHUBBA_DEG
            }
        }
    }
} satisfies Obj;
