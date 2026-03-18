import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Toliman
const RA_TOLIMAN_DEG = hmsToDeg(14, 39, 37.245600);
const DEC_TOLIMAN_DEG = dmsToDeg(-1, 60, 50, 17.880000);

export const Toliman = {
    id: 'ref:toliman',
    kind: 'star',
    name: 'Toliman',
    description: 'Toliman (ICRF/J2000) — bright star in Centaurus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe4ce',
        constellationId: 'ref:constellation:cen',
        distancePc: 1.324800,
        apparentMagnitude: 1.35,
        properMotionRaMasYr: -3678.190,
        properMotionDecMasYr: 481.840,
        radialVelocityKmS: -26.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TOLIMAN_DEG,
                dec: DEC_TOLIMAN_DEG
            }
        }
    }
} satisfies StarObj;
