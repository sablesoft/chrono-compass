import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Schedar
const RA_SCHEDAR_DEG = hmsToDeg(0, 40, 30.417600);
const DEC_SCHEDAR_DEG = dmsToDeg(1, 56, 32, 14.391600);

export const Schedar = {
    id: 'ref:schedar',
    kind: 'star',
    name: 'Schedar',
    description: 'Schedar (ICRF/J2000) — bright star in Cassiopeia.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd7b6',
        constellationId: 'ref:constellation:cas',
        distancePc: 69.979000,
        apparentMagnitude: 2.24,
        properMotionRaMasYr: 50.360,
        properMotionDecMasYr: -32.170,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SCHEDAR_DEG,
                dec: DEC_SCHEDAR_DEG
            }
        }
    }
} satisfies StarObj;
