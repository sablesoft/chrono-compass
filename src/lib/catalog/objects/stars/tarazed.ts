import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tarazed
const RA_TARAZED_DEG = hmsToDeg(19, 46, 15.578400);
const DEC_TARAZED_DEG = dmsToDeg(1, 10, 36, 47.739600);

export const Tarazed = {
    id: 'ref:tarazed',
    kind: 'star',
    name: 'Tarazed',
    description: 'Tarazed (ICRF/J2000) — bright star in Aquila.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc89c',
        constellationId: 'ref:constellation:aql',
        distancePc: 121.065400,
        apparentMagnitude: 2.72,
        properMotionRaMasYr: 15.720,
        properMotionDecMasYr: -3.080,
        radialVelocityKmS: -2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TARAZED_DEG,
                dec: DEC_TARAZED_DEG
            }
        }
    }
} satisfies StarObj;
