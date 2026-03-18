import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mahasim
const RA_MAHASIM_DEG = hmsToDeg(5, 59, 43.263600);
const DEC_MAHASIM_DEG = dmsToDeg(1, 37, 12, 45.306000);

export const Mahasim = {
    id: 'ref:mahasim',
    kind: 'star',
    name: 'Mahasim',
    description: 'Mahasim (ICRF/J2000) — bright star in Auriga.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c2d6ff',
        constellationId: 'ref:constellation:aur',
        distancePc: 50.761400,
        apparentMagnitude: 2.65,
        properMotionRaMasYr: 42.090,
        properMotionDecMasYr: -73.610,
        radialVelocityKmS: 30.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MAHASIM_DEG,
                dec: DEC_MAHASIM_DEG
            }
        }
    }
} satisfies StarObj;
