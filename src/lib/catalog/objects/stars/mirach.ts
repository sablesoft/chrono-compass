import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mirach
const RA_MIRACH_DEG = hmsToDeg(1, 9, 43.898400);
const DEC_MIRACH_DEG = dmsToDeg(1, 35, 37, 14.008800);

export const Mirach = {
    id: 'ref:mirach',
    kind: 'star',
    name: 'Mirach',
    description: 'Mirach (ICRF/J2000) — bright star in Andromeda.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc697',
        constellationId: 'ref:constellation:and',
        distancePc: 60.532700,
        apparentMagnitude: 2.07,
        properMotionRaMasYr: 175.590,
        properMotionDecMasYr: -112.230,
        radialVelocityKmS: -0.800,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIRACH_DEG,
                dec: DEC_MIRACH_DEG
            }
        }
    }
} satisfies StarObj;
