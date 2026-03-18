import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Wurren
const RA_WURREN_DEG = hmsToDeg(1, 8, 23.071200);
const DEC_WURREN_DEG = dmsToDeg(-1, 55, 14, 44.736000);

export const Wurren = {
    id: 'ref:wurren',
    kind: 'star',
    name: 'Wurren',
    description: 'Wurren (ICRF/J2000) — bright star in Phoenix.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bfd4ff',
        constellationId: 'ref:constellation:phe',
        distancePc: 91.575100,
        apparentMagnitude: 3.94,
        properMotionRaMasYr: 21.170,
        properMotionDecMasYr: 29.700,
        radialVelocityKmS: 15.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_WURREN_DEG,
                dec: DEC_WURREN_DEG
            }
        }
    }
} satisfies StarObj;
