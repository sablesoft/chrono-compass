import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Inquill
const RA_INQUILL_DEG = hmsToDeg(17, 19, 51.409200);
const DEC_INQUILL_DEG = dmsToDeg(-1, 48, 32, 57.548400);

export const Inquill = {
    id: 'ref:inquill',
    kind: 'star',
    name: 'Inquill',
    description: 'Inquill (ICRF/J2000) — bright star in Ara.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff5ea',
        constellationId: 'ref:constellation:ara',
        distancePc: 54.794500,
        apparentMagnitude: 6.67,
        properMotionRaMasYr: -35.370,
        properMotionDecMasYr: -209.840,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_INQUILL_DEG,
                dec: DEC_INQUILL_DEG
            }
        }
    }
} satisfies StarObj;
