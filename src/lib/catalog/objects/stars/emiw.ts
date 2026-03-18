import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Emiw
const RA_EMIW_DEG = hmsToDeg(1, 10, 47.125200);
const DEC_EMIW_DEG = dmsToDeg(-1, 66, 11, 17.390400);

export const Emiw = {
    id: 'ref:emiw',
    kind: 'star',
    name: 'Emiw',
    description: 'Emiw (ICRF/J2000) — bright star in Tucana.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe7d3',
        constellationId: 'ref:constellation:tuc',
        distancePc: 35.298300,
        apparentMagnitude: 8.06,
        properMotionRaMasYr: 111.790,
        properMotionDecMasYr: -123.840,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_EMIW_DEG,
                dec: DEC_EMIW_DEG
            }
        }
    }
} satisfies StarObj;
