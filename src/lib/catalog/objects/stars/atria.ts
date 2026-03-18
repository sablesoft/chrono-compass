import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Atria
const RA_ATRIA_DEG = hmsToDeg(16, 48, 39.877200);
const DEC_ATRIA_DEG = dmsToDeg(-1, 69, 1, 39.774000);

export const Atria = {
    id: 'ref:atria',
    kind: 'star',
    name: 'Atria',
    description: 'Atria (ICRF/J2000) — bright star in Triangulum Australe.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffcba0',
        constellationId: 'ref:constellation:tra',
        distancePc: 119.760500,
        apparentMagnitude: 1.91,
        properMotionRaMasYr: 17.850,
        properMotionDecMasYr: -32.920,
        radialVelocityKmS: -3.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ATRIA_DEG,
                dec: DEC_ATRIA_DEG
            }
        }
    }
} satisfies StarObj;
