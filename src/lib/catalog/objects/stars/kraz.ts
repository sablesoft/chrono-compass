import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kraz
const RA_KRAZ_DEG = hmsToDeg(12, 34, 23.235600);
const DEC_KRAZ_DEG = dmsToDeg(-1, 23, 23, 48.332400);

export const Kraz = {
    id: 'ref:kraz',
    kind: 'star',
    name: 'Kraz',
    description: 'Kraz (ICRF/J2000) — bright star in Corvus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe4ce',
        constellationId: 'ref:constellation:crv',
        distancePc: 44.662800,
        apparentMagnitude: 2.65,
        properMotionRaMasYr: 0.860,
        properMotionDecMasYr: -56.000,
        radialVelocityKmS: -8.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KRAZ_DEG,
                dec: DEC_KRAZ_DEG
            }
        }
    }
} satisfies StarObj;
