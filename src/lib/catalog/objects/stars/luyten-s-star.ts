import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Luyten's Star
const RA_LUYTENSSTAR_DEG = hmsToDeg(7, 27, 24.498000);
const DEC_LUYTENSSTAR_DEG = dmsToDeg(1, 5, 13, 32.826000);

export const LuytenSStar = {
    id: 'ref:luyten-s-star',
    kind: 'star',
    name: 'Luyten\'s Star',
    description: 'Luyten\'s Star (ICRF/J2000) — bright star in Canis Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc697',
        constellationId: 'ref:constellation:cmi',
        distancePc: 3.802600,
        apparentMagnitude: 9.84,
        properMotionRaMasYr: 571.270,
        properMotionDecMasYr: -3694.250,
        radialVelocityKmS: 18.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LUYTENSSTAR_DEG,
                dec: DEC_LUYTENSSTAR_DEG
            }
        }
    }
} satisfies StarObj;
