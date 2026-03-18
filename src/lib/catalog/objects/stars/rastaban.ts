import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rastaban
const RA_RASTABAN_DEG = hmsToDeg(17, 30, 25.966800);
const DEC_RASTABAN_DEG = dmsToDeg(1, 52, 18, 4.993200);

export const Rastaban = {
    id: 'ref:rastaban',
    kind: 'star',
    name: 'Rastaban',
    description: 'Rastaban (ICRF/J2000) — bright star in Draco.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe1c9',
        constellationId: 'ref:constellation:dra',
        distancePc: 116.550100,
        apparentMagnitude: 2.79,
        properMotionRaMasYr: -15.590,
        properMotionDecMasYr: 11.570,
        radialVelocityKmS: -20.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RASTABAN_DEG,
                dec: DEC_RASTABAN_DEG
            }
        }
    }
} satisfies StarObj;
