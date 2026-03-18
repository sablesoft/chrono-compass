import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Arcturus
const RA_ARCTURUS_DEG = hmsToDeg(14, 15, 39.7);
const DEC_ARCTURUS_DEG = dmsToDeg(1, 19, 10, 56.7);

export const Arcturus = {
    id: 'ref:arcturus',
    kind: 'star',
    name: 'Arcturus',
    description: 'Arcturus (ICRF/J2000) — the brightest star in Bootes and one of the most prominent orange stars in the sky.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffb47e',
        constellationId: 'ref:constellation:boo',
        distancePc: 11.2575,
        apparentMagnitude: -0.05,
        properMotionRaMasYr: -1093.45,
        properMotionDecMasYr: -1999.4,
        radialVelocityKmS: -5,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ARCTURUS_DEG,
                dec: DEC_ARCTURUS_DEG
            }
        }
    }
} satisfies StarObj;
