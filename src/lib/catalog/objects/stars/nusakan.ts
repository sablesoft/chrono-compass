import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Nusakan
const RA_NUSAKAN_DEG = hmsToDeg(15, 27, 49.744800);
const DEC_NUSAKAN_DEG = dmsToDeg(1, 29, 6, 20.530800);

export const Nusakan = {
    id: 'ref:nusakan',
    kind: 'star',
    name: 'Nusakan',
    description: 'Nusakan (ICRF/J2000) — bright star in Corona Borealis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#e9edff',
        constellationId: 'ref:constellation:crb',
        distancePc: 34.281800,
        apparentMagnitude: 3.66,
        properMotionRaMasYr: -181.390,
        properMotionDecMasYr: 86.840,
        radialVelocityKmS: -19.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_NUSAKAN_DEG,
                dec: DEC_NUSAKAN_DEG
            }
        }
    }
} satisfies StarObj;
