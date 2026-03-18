import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tupi
const RA_TUPI_DEG = hmsToDeg(3, 39, 43.171200);
const DEC_TUPI_DEG = dmsToDeg(-1, 52, 54, 57.016800);

export const Tupi = {
    id: 'ref:tupi',
    kind: 'star',
    name: 'Tupi',
    description: 'Tupi (ICRF/J2000) — bright star in Reticulum.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff7ee',
        constellationId: 'ref:constellation:ret',
        distancePc: 33.886800,
        apparentMagnitude: 7.12,
        properMotionRaMasYr: -193.620,
        properMotionDecMasYr: -91.920,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TUPI_DEG,
                dec: DEC_TUPI_DEG
            }
        }
    }
} satisfies StarObj;
