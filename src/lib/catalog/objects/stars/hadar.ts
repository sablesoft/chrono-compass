import { dmsToDeg, hmsToDeg, type Obj } from '../../types';

// J2000 coordinates for Hadar
const RA_HADAR_DEG = hmsToDeg(14, 3, 49.4);
const DEC_HADAR_DEG = dmsToDeg(-1, 60, 22, 23.0);

export const Hadar = {
    id: 'ref:hadar',
    kind: 'reference',
    name: 'Hadar',
    description: 'Hadar (ICRF/J2000) — Beta Centauri, one of the brightest southern stars and a major navigational companion to the Southern Cross.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cfe0ff',
        distancePc: 120.1922,
        apparentMagnitude: 0.61,
        properMotionRaMasYr: -33.96,
        properMotionDecMasYr: -25.06,
        radialVelocityKmS: 6,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HADAR_DEG,
                dec: DEC_HADAR_DEG
            }
        }
    }
} satisfies Obj;
