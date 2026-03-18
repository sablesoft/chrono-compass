import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Markeb
const RA_MARKEB_DEG = hmsToDeg(9, 22, 6.823200);
const DEC_MARKEB_DEG = dmsToDeg(-1, 55, 0, 38.404800);

export const Markeb = {
    id: 'ref:markeb',
    kind: 'star',
    name: 'Markeb',
    description: 'Markeb (ICRF/J2000) — bright star in Vela.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bed3ff',
        constellationId: 'ref:constellation:vel',
        distancePc: 175.438600,
        apparentMagnitude: 2.47,
        properMotionRaMasYr: -10.720,
        properMotionDecMasYr: 11.240,
        radialVelocityKmS: 22.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MARKEB_DEG,
                dec: DEC_MARKEB_DEG
            }
        }
    }
} satisfies StarObj;
