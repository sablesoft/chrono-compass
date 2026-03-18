import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Karaka
const RA_KARAKA_DEG = hmsToDeg(15, 35, 40.063200);
const DEC_KARAKA_DEG = dmsToDeg(-1, 80, 12, 16.513200);

export const Karaka = {
    id: 'ref:karaka',
    kind: 'star',
    name: 'Karaka',
    description: 'Karaka (ICRF/J2000) — bright star in Apus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe4cf',
        constellationId: 'ref:constellation:aps',
        distancePc: 39.231100,
        apparentMagnitude: 8.71,
        properMotionRaMasYr: -47.570,
        properMotionDecMasYr: 44.040,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KARAKA_DEG,
                dec: DEC_KARAKA_DEG
            }
        }
    }
} satisfies StarObj;
