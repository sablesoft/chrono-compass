import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mothallah
const RA_MOTHALLAH_DEG = hmsToDeg(1, 53, 4.905600);
const DEC_MOTHALLAH_DEG = dmsToDeg(1, 29, 34, 43.784400);

export const Mothallah = {
    id: 'ref:mothallah',
    kind: 'star',
    name: 'Mothallah',
    description: 'Mothallah (ICRF/J2000) — bright star in Triangulum.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fffdf9',
        constellationId: 'ref:constellation:tri',
        distancePc: 19.417500,
        apparentMagnitude: 3.42,
        properMotionRaMasYr: 12.020,
        properMotionDecMasYr: -233.690,
        radialVelocityKmS: -16.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MOTHALLAH_DEG,
                dec: DEC_MOTHALLAH_DEG
            }
        }
    }
} satisfies StarObj;
