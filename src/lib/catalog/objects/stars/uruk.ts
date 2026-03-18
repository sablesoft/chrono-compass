import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Uruk
const RA_URUK_DEG = hmsToDeg(19, 32, 4.160400);
const DEC_URUK_DEG = dmsToDeg(1, 16, 28, 27.444000);

export const Uruk = {
    id: 'ref:uruk',
    kind: 'star',
    name: 'Uruk',
    description: 'Uruk (ICRF/J2000) — bright star in Sagitta.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fffaf3',
        constellationId: 'ref:constellation:sge',
        distancePc: 118.483400,
        apparentMagnitude: 8.97,
        properMotionRaMasYr: 63.680,
        properMotionDecMasYr: 15.490,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_URUK_DEG,
                dec: DEC_URUK_DEG
            }
        }
    }
} satisfies StarObj;
