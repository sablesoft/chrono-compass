import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sualocin
const RA_SUALOCIN_DEG = hmsToDeg(20, 39, 38.286000);
const DEC_SUALOCIN_DEG = dmsToDeg(1, 15, 54, 43.459200);

export const Sualocin = {
    id: 'ref:sualocin',
    kind: 'star',
    name: 'Sualocin',
    description: 'Sualocin (ICRF/J2000) — bright star in Delphinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c4d7ff',
        constellationId: 'ref:constellation:del',
        distancePc: 77.821000,
        apparentMagnitude: 3.77,
        properMotionRaMasYr: 54.140,
        properMotionDecMasYr: 7.910,
        radialVelocityKmS: -3.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SUALOCIN_DEG,
                dec: DEC_SUALOCIN_DEG
            }
        }
    }
} satisfies StarObj;
