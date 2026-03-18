import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kaffaljidhma
const RA_KAFFALJIDHMA_DEG = hmsToDeg(2, 43, 18.040800);
const DEC_KAFFALJIDHMA_DEG = dmsToDeg(1, 3, 14, 8.944800);

export const Kaffaljidhma = {
    id: 'ref:kaffaljidhma',
    kind: 'star',
    name: 'Kaffaljidhma',
    description: 'Kaffaljidhma (ICRF/J2000) — bright star in Cetus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d1deff',
        constellationId: 'ref:constellation:cet',
        distancePc: 24.408100,
        apparentMagnitude: 3.47,
        properMotionRaMasYr: -146.430,
        properMotionDecMasYr: -145.270,
        radialVelocityKmS: -5.100,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KAFFALJIDHMA_DEG,
                dec: DEC_KAFFALJIDHMA_DEG
            }
        }
    }
} satisfies StarObj;
