import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Xami
const RA_XAMI_DEG = hmsToDeg(14, 42, 30.571200);
const DEC_XAMI_DEG = dmsToDeg(-1, 64, 58, 30.496800);

export const Xami = {
    id: 'ref:xami',
    kind: 'star',
    name: 'Xami',
    description: 'Xami (ICRF/J2000) — bright star in Circinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#e1e8ff',
        constellationId: 'ref:constellation:cir',
        distancePc: 16.570000,
        apparentMagnitude: 3.18,
        properMotionRaMasYr: -192.640,
        properMotionDecMasYr: -234.070,
        radialVelocityKmS: 7.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_XAMI_DEG,
                dec: DEC_XAMI_DEG
            }
        }
    }
} satisfies StarObj;
