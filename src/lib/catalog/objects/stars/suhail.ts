import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Suhail
const RA_SUHAIL_DEG = hmsToDeg(9, 7, 59.764800);
const DEC_SUHAIL_DEG = dmsToDeg(-1, 43, 25, 57.320400);

export const Suhail = {
    id: 'ref:suhail',
    kind: 'star',
    name: 'Suhail',
    description: 'Suhail (ICRF/J2000) — bright star in Vela.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc290',
        constellationId: 'ref:constellation:vel',
        distancePc: 166.944900,
        apparentMagnitude: 2.23,
        properMotionRaMasYr: -23.210,
        properMotionDecMasYr: 14.280,
        radialVelocityKmS: 18.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SUHAIL_DEG,
                dec: DEC_SUHAIL_DEG
            }
        }
    }
} satisfies StarObj;
