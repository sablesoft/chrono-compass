import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kornephoros
const RA_KORNEPHOROS_DEG = hmsToDeg(16, 30, 13.204800);
const DEC_KORNEPHOROS_DEG = dmsToDeg(1, 21, 29, 22.606800);

export const Kornephoros = {
    id: 'ref:kornephoros',
    kind: 'star',
    name: 'Kornephoros',
    description: 'Kornephoros (ICRF/J2000) — bright star in Hercules.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe1c9',
        constellationId: 'ref:constellation:her',
        distancePc: 42.662100,
        apparentMagnitude: 2.78,
        properMotionRaMasYr: -98.430,
        properMotionDecMasYr: -14.490,
        radialVelocityKmS: -26.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KORNEPHOROS_DEG,
                dec: DEC_KORNEPHOROS_DEG
            }
        }
    }
} satisfies StarObj;
