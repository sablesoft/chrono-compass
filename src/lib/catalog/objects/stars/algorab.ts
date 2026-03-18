import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Algorab
const RA_ALGORAB_DEG = hmsToDeg(12, 29, 51.860400);
const DEC_ALGORAB_DEG = dmsToDeg(-1, 16, 30, 55.555200);

export const Algorab = {
    id: 'ref:algorab',
    kind: 'star',
    name: 'Algorab',
    description: 'Algorab (ICRF/J2000) — bright star in Corvus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c8d9ff',
        constellationId: 'ref:constellation:crv',
        distancePc: 26.631200,
        apparentMagnitude: 2.94,
        properMotionRaMasYr: -209.970,
        properMotionDecMasYr: -139.300,
        radialVelocityKmS: 9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALGORAB_DEG,
                dec: DEC_ALGORAB_DEG
            }
        }
    }
} satisfies StarObj;
