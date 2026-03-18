import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alkes
const RA_ALKES_DEG = hmsToDeg(10, 59, 46.478400);
const DEC_ALKES_DEG = dmsToDeg(-1, 18, 17, 55.618800);

export const Alkes = {
    id: 'ref:alkes',
    kind: 'star',
    name: 'Alkes',
    description: 'Alkes (ICRF/J2000) — bright star in Crater.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdbbe',
        constellationId: 'ref:constellation:crt',
        distancePc: 48.804300,
        apparentMagnitude: 4.08,
        properMotionRaMasYr: -462.390,
        properMotionDecMasYr: 129.110,
        radialVelocityKmS: 47.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALKES_DEG,
                dec: DEC_ALKES_DEG
            }
        }
    }
} satisfies StarObj;
