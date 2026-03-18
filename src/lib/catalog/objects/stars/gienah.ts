import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Gienah
const RA_GIENAH_DEG = hmsToDeg(12, 15, 48.373200);
const DEC_GIENAH_DEG = dmsToDeg(-1, 17, 32, 30.944400);

export const Gienah = {
    id: 'ref:gienah',
    kind: 'star',
    name: 'Gienah',
    description: 'Gienah (ICRF/J2000) — bright star in Corvus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c0d4ff',
        constellationId: 'ref:constellation:crv',
        distancePc: 47.103200,
        apparentMagnitude: 2.58,
        properMotionRaMasYr: -159.580,
        properMotionDecMasYr: 22.310,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GIENAH_DEG,
                dec: DEC_GIENAH_DEG
            }
        }
    }
} satisfies StarObj;
