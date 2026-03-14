import { dmsToDeg, hmsToDeg, type Obj } from '../../types';

// J2000 coordinates for Fomalhaut
const RA_FOMALHAUT_DEG = hmsToDeg(22, 57, 39.1);
const DEC_FOMALHAUT_DEG = dmsToDeg(-1, 29, 37, 20.0);

export const Fomalhaut = {
    id: 'ref:fomalhaut',
    kind: 'reference',
    name: 'Fomalhaut',
    description: 'Fomalhaut (ICRF/J2000) — Alpha Piscis Austrini, one of the brightest solitary stars and a major royal star in many traditions.',
    emoji: '✦',
    meta: {
        color: '#dff5ff',
        distancePc: 7.7037,
        apparentMagnitude: 1.17,
        properMotionRaMasYr: 329.22,
        properMotionDecMasYr: -164.22,
        radialVelocityKmS: 6.1,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_FOMALHAUT_DEG,
                dec: DEC_FOMALHAUT_DEG
            }
        }
    }
} satisfies Obj;
