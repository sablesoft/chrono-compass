import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Macondo
const RA_MACONDO_DEG = hmsToDeg(10, 44, 20.925600);
const DEC_MACONDO_DEG = dmsToDeg(-1, 33, 34, 37.279200);

export const Macondo = {
    id: 'ref:macondo',
    kind: 'star',
    name: 'Macondo',
    description: 'Macondo (ICRF/J2000) — bright star in Antila.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe2ca',
        constellationId: 'ref:constellation:ant',
        distancePc: 27.855200,
        apparentMagnitude: 8.30,
        properMotionRaMasYr: -92.840,
        properMotionDecMasYr: -151.120,
        radialVelocityKmS: 41.700,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MACONDO_DEG,
                dec: DEC_MACONDO_DEG
            }
        }
    }
} satisfies StarObj;
