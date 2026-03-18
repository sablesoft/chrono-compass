import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Enif
const RA_ENIF_DEG = hmsToDeg(21, 44, 11.158800);
const DEC_ENIF_DEG = dmsToDeg(1, 9, 52, 30.039600);

export const Enif = {
    id: 'ref:enif',
    kind: 'star',
    name: 'Enif',
    description: 'Enif (ICRF/J2000) — bright star in Pegasus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc89b',
        constellationId: 'ref:constellation:peg',
        distancePc: 211.416500,
        apparentMagnitude: 2.38,
        properMotionRaMasYr: 30.020,
        properMotionDecMasYr: 1.380,
        radialVelocityKmS: 5.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ENIF_DEG,
                dec: DEC_ENIF_DEG
            }
        }
    }
} satisfies StarObj;
