import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Canopus
const RA_CANOPUS_DEG = hmsToDeg(6, 23, 57.102000);
const DEC_CANOPUS_DEG = dmsToDeg(-1, 52, 41, 44.376000);

export const Canopus = {
    id: 'ref:canopus',
    kind: 'star',
    name: 'Canopus',
    description: 'Canopus (ICRF/J2000) — bright star in Carina.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d7e2ff',
        constellationId: 'ref:constellation:car',
        distancePc: 94.786700,
        apparentMagnitude: -0.62,
        properMotionRaMasYr: 19.990,
        properMotionDecMasYr: 23.670,
        radialVelocityKmS: 21.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CANOPUS_DEG,
                dec: DEC_CANOPUS_DEG
            }
        }
    }
} satisfies StarObj;
