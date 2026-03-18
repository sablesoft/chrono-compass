import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alfirk
const RA_ALFIRK_DEG = hmsToDeg(21, 28, 39.583200);
const DEC_ALFIRK_DEG = dmsToDeg(1, 70, 33, 38.577600);

export const Alfirk = {
    id: 'ref:alfirk',
    kind: 'star',
    name: 'Alfirk',
    description: 'Alfirk (ICRF/J2000) — bright star in Cepheus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#b9d0ff',
        constellationId: 'ref:constellation:cep',
        distancePc: 210.084000,
        apparentMagnitude: 3.23,
        properMotionRaMasYr: 12.600,
        properMotionDecMasYr: 8.730,
        radialVelocityKmS: -8.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALFIRK_DEG,
                dec: DEC_ALFIRK_DEG
            }
        }
    }
} satisfies StarObj;
