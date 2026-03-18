import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Algieba
const RA_ALGIEBA_DEG = hmsToDeg(10, 19, 58.342800);
const DEC_ALGIEBA_DEG = dmsToDeg(1, 19, 50, 29.360400);

export const Algieba = {
    id: 'ref:algieba',
    kind: 'star',
    name: 'Algieba',
    description: 'Algieba (ICRF/J2000) — bright star in Leo.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd9ba',
        constellationId: 'ref:constellation:leo',
        distancePc: 39.888300,
        apparentMagnitude: 2.01,
        properMotionRaMasYr: 310.770,
        properMotionDecMasYr: -152.880,
        radialVelocityKmS: -37.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALGIEBA_DEG,
                dec: DEC_ALGIEBA_DEG
            }
        }
    }
} satisfies StarObj;
