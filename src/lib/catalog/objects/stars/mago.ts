import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mago
const RA_MAGO_DEG = hmsToDeg(5, 9, 36.651600);
const DEC_MAGO_DEG = dmsToDeg(1, 69, 38, 21.843600);

export const Mago = {
    id: 'ref:mago',
    kind: 'star',
    name: 'Mago',
    description: 'Mago (ICRF/J2000) — bright star in Camelopardis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdabc',
        constellationId: 'ref:constellation:cam',
        distancePc: 120.627300,
        apparentMagnitude: 6.43,
        properMotionRaMasYr: 60.420,
        properMotionDecMasYr: -63.550,
        radialVelocityKmS: -8.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MAGO_DEG,
                dec: DEC_MAGO_DEG
            }
        }
    }
} satisfies StarObj;
