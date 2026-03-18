import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Zhou
const RA_ZHOU_DEG = hmsToDeg(15, 46, 11.254800);
const DEC_ZHOU_DEG = dmsToDeg(1, 15, 25, 18.573600);

export const Zhou = {
    id: 'ref:zhou',
    kind: 'star',
    name: 'Zhou',
    description: 'Zhou (ICRF/J2000) — bright star in Serpens Caput.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cfddff',
        constellationId: 'ref:constellation:ser1',
        distancePc: 47.551100,
        apparentMagnitude: 3.65,
        properMotionRaMasYr: 68.540,
        properMotionDecMasYr: -41.310,
        radialVelocityKmS: -1.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ZHOU_DEG,
                dec: DEC_ZHOU_DEG
            }
        }
    }
} satisfies StarObj;
