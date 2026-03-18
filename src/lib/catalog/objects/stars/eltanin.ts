import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Eltanin
const RA_ELTANIN_DEG = hmsToDeg(17, 56, 36.373200);
const DEC_ELTANIN_DEG = dmsToDeg(1, 51, 29, 20.022000);

export const Eltanin = {
    id: 'ref:eltanin',
    kind: 'star',
    name: 'Eltanin',
    description: 'Eltanin (ICRF/J2000) — bright star in Draco.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc89b',
        constellationId: 'ref:constellation:dra',
        distancePc: 47.303700,
        apparentMagnitude: 2.24,
        properMotionRaMasYr: -8.520,
        properMotionDecMasYr: -23.050,
        radialVelocityKmS: -28.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ELTANIN_DEG,
                dec: DEC_ELTANIN_DEG
            }
        }
    }
} satisfies StarObj;
