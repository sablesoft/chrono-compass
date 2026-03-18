import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Meridiana
const RA_MERIDIANA_DEG = hmsToDeg(19, 9, 28.328400);
const DEC_MERIDIANA_DEG = dmsToDeg(-1, 37, 54, 16.106400);

export const Meridiana = {
    id: 'ref:meridiana',
    kind: 'star',
    name: 'Meridiana',
    description: 'Meridiana (ICRF/J2000) — bright star in Corona Australis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ccdcff',
        constellationId: 'ref:constellation:cra',
        distancePc: 38.432000,
        apparentMagnitude: 4.11,
        properMotionRaMasYr: 85.730,
        properMotionDecMasYr: -96.650,
        radialVelocityKmS: -18.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MERIDIANA_DEG,
                dec: DEC_MERIDIANA_DEG
            }
        }
    }
} satisfies StarObj;
