import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Caph
const RA_CAPH_DEG = hmsToDeg(0, 9, 10.393200);
const DEC_CAPH_DEG = dmsToDeg(1, 59, 8, 59.208000);

export const Caph = {
    id: 'ref:caph',
    kind: 'star',
    name: 'Caph',
    description: 'Caph (ICRF/J2000) — bright star in Cassiopeia.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#f3f2ff',
        constellationId: 'ref:constellation:cas',
        distancePc: 16.784200,
        apparentMagnitude: 2.28,
        properMotionRaMasYr: 523.390,
        properMotionDecMasYr: -180.420,
        radialVelocityKmS: 11.300,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CAPH_DEG,
                dec: DEC_CAPH_DEG
            }
        }
    }
} satisfies StarObj;
