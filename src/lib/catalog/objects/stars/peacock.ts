import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Peacock
const RA_PEACOCK_DEG = hmsToDeg(20, 25, 38.852400);
const DEC_PEACOCK_DEG = dmsToDeg(-1, 56, 44, 6.324000);

export const Peacock = {
    id: 'ref:peacock',
    kind: 'star',
    name: 'Peacock',
    description: 'Peacock (ICRF/J2000) — bright star in Pavo.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c0d4ff',
        constellationId: 'ref:constellation:pav',
        distancePc: 54.824600,
        apparentMagnitude: 1.94,
        properMotionRaMasYr: 7.710,
        properMotionDecMasYr: -86.150,
        radialVelocityKmS: 2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PEACOCK_DEG,
                dec: DEC_PEACOCK_DEG
            }
        }
    }
} satisfies StarObj;
