import { dmsToDeg, hmsToDeg, type Obj } from '../../types';

// J2000 coordinates for Alfard
const RA_ALFARD_DEG = hmsToDeg(9, 27, 35.2);
const DEC_ALFARD_DEG = dmsToDeg(-1, 8, 39, 31.0);

export const Alfard = {
    id: 'ref:alfard',
    kind: 'reference',
    name: 'Alfard',
    description: 'Alfard (ICRF/J2000) — Alpha Hydrae, the solitary bright star of Hydra and a well-known marker of the Water Serpent.',
    emoji: '✦',
    meta: {
        color: '#f0d6b5',
        distancePc: 55.2791,
        apparentMagnitude: 1.99,
        properMotionRaMasYr: -14.49,
        properMotionDecMasYr: 33.25,
        radialVelocityKmS: -4,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALFARD_DEG,
                dec: DEC_ALFARD_DEG
            }
        }
    }
} satisfies Obj;
