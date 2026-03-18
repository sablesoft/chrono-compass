import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Bharani
const RA_BHARANI_DEG = hmsToDeg(2, 49, 59.026800);
const DEC_BHARANI_DEG = dmsToDeg(1, 27, 15, 37.825200);

export const Bharani = {
    id: 'ref:bharani',
    kind: 'star',
    name: 'Bharani',
    description: 'Bharani (ICRF/J2000) — bright star in Aries.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c1d5ff',
        constellationId: 'ref:constellation:ari',
        distancePc: 50.787200,
        apparentMagnitude: 3.61,
        properMotionRaMasYr: 65.470,
        properMotionDecMasYr: -116.590,
        radialVelocityKmS: 4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BHARANI_DEG,
                dec: DEC_BHARANI_DEG
            }
        }
    }
} satisfies StarObj;
