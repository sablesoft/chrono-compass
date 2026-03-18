import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Yed Prior
const RA_YEDPRIOR_DEG = hmsToDeg(16, 14, 20.738400);
const DEC_YEDPRIOR_DEG = dmsToDeg(-1, 3, 41, 39.562800);

export const YedPrior = {
    id: 'ref:yed-prior',
    kind: 'star',
    name: 'Yed Prior',
    description: 'Yed Prior (ICRF/J2000) — bright star in Ophiuchus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc596',
        constellationId: 'ref:constellation:oph',
        distancePc: 52.465900,
        apparentMagnitude: 2.73,
        properMotionRaMasYr: -45.830,
        properMotionDecMasYr: -142.910,
        radialVelocityKmS: -20.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_YEDPRIOR_DEG,
                dec: DEC_YEDPRIOR_DEG
            }
        }
    }
} satisfies StarObj;
