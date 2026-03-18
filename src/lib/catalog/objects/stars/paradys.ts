import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Paradys
const RA_PARADYS_DEG = hmsToDeg(14, 47, 51.723600);
const DEC_PARADYS_DEG = dmsToDeg(-1, 79, 2, 41.103600);

export const Paradys = {
    id: 'ref:paradys',
    kind: 'star',
    name: 'Paradys',
    description: 'Paradys (ICRF/J2000) — bright star in Apus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffcba1',
        constellationId: 'ref:constellation:aps',
        distancePc: 136.986300,
        apparentMagnitude: 3.83,
        properMotionRaMasYr: -5.670,
        properMotionDecMasYr: -15.750,
        radialVelocityKmS: -1.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PARADYS_DEG,
                dec: DEC_PARADYS_DEG
            }
        }
    }
} satisfies StarObj;
