import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sāmaya
const RA_SAMAYA_DEG = hmsToDeg(21, 38, 8.404800);
const DEC_SAMAYA_DEG = dmsToDeg(-1, 31, 44, 14.946000);

export const Samaya = {
    id: 'ref:samaya',
    kind: 'star',
    name: 'Sāmaya',
    description: 'Sāmaya (ICRF/J2000) — bright star in Pisces Austrinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff9f2',
        constellationId: 'ref:constellation:psa',
        distancePc: 107.758600,
        apparentMagnitude: 8.56,
        properMotionRaMasYr: 23.460,
        properMotionDecMasYr: -82.190,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SAMAYA_DEG,
                dec: DEC_SAMAYA_DEG
            }
        }
    }
} satisfies StarObj;
