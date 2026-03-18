import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Uúba
const RA_UUBA_DEG = hmsToDeg(23, 54, 40.168800);
const DEC_UUBA_DEG = dmsToDeg(-1, 37, 37, 40.526400);

export const Uuba = {
    id: 'ref:uuba',
    kind: 'star',
    name: 'Uúba',
    description: 'Uúba (ICRF/J2000) — bright star in Sculptor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe9d6',
        constellationId: 'ref:constellation:scl',
        distancePc: 77.101000,
        apparentMagnitude: 9.79,
        properMotionRaMasYr: 248.750,
        properMotionDecMasYr: -70.190,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_UUBA_DEG,
                dec: DEC_UUBA_DEG
            }
        }
    }
} satisfies StarObj;
