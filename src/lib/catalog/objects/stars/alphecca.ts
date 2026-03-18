import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alphecca
const RA_ALPHECCA_DEG = hmsToDeg(15, 34, 41.260800);
const DEC_ALPHECCA_DEG = dmsToDeg(1, 26, 42, 52.894800);

export const Alphecca = {
    id: 'ref:alphecca',
    kind: 'star',
    name: 'Alphecca',
    description: 'Alphecca (ICRF/J2000) — bright star in Corona Borealis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cbdbff',
        constellationId: 'ref:constellation:crb',
        distancePc: 23.009700,
        apparentMagnitude: 2.22,
        properMotionRaMasYr: 120.380,
        properMotionDecMasYr: -89.440,
        radialVelocityKmS: 2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALPHECCA_DEG,
                dec: DEC_ALPHECCA_DEG
            }
        }
    }
} satisfies StarObj;
