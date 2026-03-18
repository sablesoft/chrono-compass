import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tonatiuh
const RA_TONATIUH_DEG = hmsToDeg(12, 5, 14.823600);
const DEC_TONATIUH_DEG = dmsToDeg(1, 76, 54, 20.642400);

export const Tonatiuh = {
    id: 'ref:tonatiuh',
    kind: 'star',
    name: 'Tonatiuh',
    description: 'Tonatiuh (ICRF/J2000) — bright star in Camelopardis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffddc2',
        constellationId: 'ref:constellation:cam',
        distancePc: 97.087400,
        apparentMagnitude: 5.78,
        properMotionRaMasYr: 147.220,
        properMotionDecMasYr: -92.360,
        radialVelocityKmS: -20.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TONATIUH_DEG,
                dec: DEC_TONATIUH_DEG
            }
        }
    }
} satisfies StarObj;
