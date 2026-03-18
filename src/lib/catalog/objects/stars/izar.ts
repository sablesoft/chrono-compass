import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Izar
const RA_IZAR_DEG = hmsToDeg(14, 44, 59.222400);
const DEC_IZAR_DEG = dmsToDeg(1, 27, 4, 27.199200);

export const Izar = {
    id: 'ref:izar',
    kind: 'star',
    name: 'Izar',
    description: 'Izar (ICRF/J2000) — bright star in Bootes.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe0c8',
        constellationId: 'ref:constellation:boo',
        distancePc: 62.111800,
        apparentMagnitude: 2.35,
        properMotionRaMasYr: -50.650,
        properMotionDecMasYr: 20.000,
        radialVelocityKmS: -23.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_IZAR_DEG,
                dec: DEC_IZAR_DEG
            }
        }
    }
} satisfies StarObj;
