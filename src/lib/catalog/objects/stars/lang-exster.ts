import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Lang-Exster
const RA_LANGEXSTER_DEG = hmsToDeg(22, 18, 30.135600);
const DEC_LANGEXSTER_DEG = dmsToDeg(-1, 60, 15, 34.513200);

export const LangExster = {
    id: 'ref:lang-exster',
    kind: 'star',
    name: 'Lang-Exster',
    description: 'Lang-Exster (ICRF/J2000) — bright star in Tucana.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffcda5',
        constellationId: 'ref:constellation:tuc',
        distancePc: 61.237000,
        apparentMagnitude: 2.87,
        properMotionRaMasYr: -71.480,
        properMotionDecMasYr: -38.150,
        radialVelocityKmS: 42.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LANGEXSTER_DEG,
                dec: DEC_LANGEXSTER_DEG
            }
        }
    }
} satisfies StarObj;
