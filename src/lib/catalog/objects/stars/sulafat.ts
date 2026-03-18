import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sulafat
const RA_SULAFAT_DEG = hmsToDeg(18, 58, 56.622000);
const DEC_SULAFAT_DEG = dmsToDeg(1, 32, 41, 22.405200);

export const Sulafat = {
    id: 'ref:sulafat',
    kind: 'star',
    name: 'Sulafat',
    description: 'Sulafat (ICRF/J2000) — bright star in Lyra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c5d7ff',
        constellationId: 'ref:constellation:lyr',
        distancePc: 190.114100,
        apparentMagnitude: 3.25,
        properMotionRaMasYr: -2.760,
        properMotionDecMasYr: 1.770,
        radialVelocityKmS: -21.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SULAFAT_DEG,
                dec: DEC_SULAFAT_DEG
            }
        }
    }
} satisfies StarObj;
