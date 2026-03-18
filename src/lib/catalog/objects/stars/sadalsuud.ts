import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sadalsuud
const RA_SADALSUUD_DEG = hmsToDeg(21, 31, 33.535200);
const DEC_SADALSUUD_DEG = dmsToDeg(-1, 5, 34, 16.219200);

export const Sadalsuud = {
    id: 'ref:sadalsuud',
    kind: 'star',
    name: 'Sadalsuud',
    description: 'Sadalsuud (ICRF/J2000) — bright star in Aquarius.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe8d5',
        constellationId: 'ref:constellation:aqr',
        distancePc: 164.744600,
        apparentMagnitude: 2.90,
        properMotionRaMasYr: 22.790,
        properMotionDecMasYr: -6.700,
        radialVelocityKmS: 7.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SADALSUUD_DEG,
                dec: DEC_SADALSUUD_DEG
            }
        }
    }
} satisfies StarObj;
