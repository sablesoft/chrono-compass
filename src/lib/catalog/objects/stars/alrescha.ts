import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alrescha
const RA_ALRESCHA_DEG = hmsToDeg(2, 2, 2.821200);
const DEC_ALRESCHA_DEG = dmsToDeg(1, 2, 45, 49.532400);

export const Alrescha = {
    id: 'ref:alrescha',
    kind: 'star',
    name: 'Alrescha',
    description: 'Alrescha (ICRF/J2000) — bright star in Pisces.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cbdbff',
        constellationId: 'ref:constellation:psc',
        distancePc: 46.168100,
        apparentMagnitude: 3.82,
        properMotionRaMasYr: 33.290,
        properMotionDecMasYr: -0.420,
        radialVelocityKmS: 9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALRESCHA_DEG,
                dec: DEC_ALRESCHA_DEG
            }
        }
    }
} satisfies StarObj;
