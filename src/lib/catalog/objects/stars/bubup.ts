import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Bubup
const RA_BUBUP_DEG = hmsToDeg(5, 37, 1.808400);
const DEC_BUBUP_DEG = dmsToDeg(-1, 73, 41, 57.634800);

export const Bubup = {
    id: 'ref:bubup',
    kind: 'star',
    name: 'Bubup',
    description: 'Bubup (ICRF/J2000) — bright star in Mensa.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff7ee',
        constellationId: 'ref:constellation:men',
        distancePc: 38.314200,
        apparentMagnitude: 6.69,
        properMotionRaMasYr: 138.790,
        properMotionDecMasYr: -107.290,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BUBUP_DEG,
                dec: DEC_BUBUP_DEG
            }
        }
    }
} satisfies StarObj;
