import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Almach
const RA_ALMACH_DEG = hmsToDeg(2, 3, 53.942400);
const DEC_ALMACH_DEG = dmsToDeg(1, 42, 19, 47.010000);

export const Almach = {
    id: 'ref:almach',
    kind: 'star',
    name: 'Almach',
    description: 'Almach (ICRF/J2000) — bright star in Andromeda.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffcea6',
        constellationId: 'ref:constellation:and',
        distancePc: 120.481900,
        apparentMagnitude: 2.10,
        properMotionRaMasYr: 43.080,
        properMotionDecMasYr: -50.850,
        radialVelocityKmS: -12.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALMACH_DEG,
                dec: DEC_ALMACH_DEG
            }
        }
    }
} satisfies StarObj;
