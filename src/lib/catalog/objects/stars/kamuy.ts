import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kamuy
const RA_KAMUY_DEG = hmsToDeg(16, 10, 3.914400);
const DEC_KAMUY_DEG = dmsToDeg(1, 26, 44, 33.900000);

export const Kamuy = {
    id: 'ref:kamuy',
    kind: 'star',
    name: 'Kamuy',
    description: 'Kamuy (ICRF/J2000) — bright star in Corona Borealis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffddc1',
        constellationId: 'ref:constellation:crb',
        distancePc: 125.313300,
        apparentMagnitude: 6.57,
        properMotionRaMasYr: -18.350,
        properMotionDecMasYr: 37.660,
        radialVelocityKmS: -4.600,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KAMUY_DEG,
                dec: DEC_KAMUY_DEG
            }
        }
    }
} satisfies StarObj;
