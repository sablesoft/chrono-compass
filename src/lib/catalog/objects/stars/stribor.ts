import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Stribor
const RA_STRIBOR_DEG = hmsToDeg(8, 53, 50.816400);
const DEC_STRIBOR_DEG = dmsToDeg(1, 33, 3, 24.523200);

export const Stribor = {
    id: 'ref:stribor',
    kind: 'star',
    name: 'Stribor',
    description: 'Stribor (ICRF/J2000) — bright star in Lynx.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff4e9',
        constellationId: 'ref:constellation:lyn',
        distancePc: 75.757600,
        apparentMagnitude: 8.03,
        properMotionRaMasYr: -95.600,
        properMotionDecMasYr: -28.240,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_STRIBOR_DEG,
                dec: DEC_STRIBOR_DEG
            }
        }
    }
} satisfies StarObj;
