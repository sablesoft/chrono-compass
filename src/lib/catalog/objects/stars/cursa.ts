import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Cursa
const RA_CURSA_DEG = hmsToDeg(5, 7, 50.984400);
const DEC_CURSA_DEG = dmsToDeg(-1, 5, 5, 11.205600);

export const Cursa = {
    id: 'ref:cursa',
    kind: 'star',
    name: 'Cursa',
    description: 'Cursa (ICRF/J2000) — bright star in Eridanus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d7e2ff',
        constellationId: 'ref:constellation:eri',
        distancePc: 27.397300,
        apparentMagnitude: 2.78,
        properMotionRaMasYr: -83.390,
        properMotionDecMasYr: -75.440,
        radialVelocityKmS: -9.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CURSA_DEG,
                dec: DEC_CURSA_DEG
            }
        }
    }
} satisfies StarObj;
