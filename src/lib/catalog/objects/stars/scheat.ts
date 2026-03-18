import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Scheat
const RA_SCHEAT_DEG = hmsToDeg(23, 3, 46.443600);
const DEC_SCHEAT_DEG = dmsToDeg(1, 28, 4, 58.040400);

export const Scheat = {
    id: 'ref:scheat',
    kind: 'star',
    name: 'Scheat',
    description: 'Scheat (ICRF/J2000) — bright star in Pegasus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc391',
        constellationId: 'ref:constellation:peg',
        distancePc: 60.096200,
        apparentMagnitude: 2.44,
        properMotionRaMasYr: 187.760,
        properMotionDecMasYr: 137.610,
        radialVelocityKmS: 9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SCHEAT_DEG,
                dec: DEC_SCHEAT_DEG
            }
        }
    }
} satisfies StarObj;
