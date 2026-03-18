import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alhena
const RA_ALHENA_DEG = hmsToDeg(6, 37, 42.700800);
const DEC_ALHENA_DEG = dmsToDeg(1, 16, 23, 57.307200);

export const Alhena = {
    id: 'ref:alhena',
    kind: 'star',
    name: 'Alhena',
    description: 'Alhena (ICRF/J2000) — bright star in Gemini.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c9daff',
        constellationId: 'ref:constellation:gem',
        distancePc: 33.512100,
        apparentMagnitude: 1.93,
        properMotionRaMasYr: -2.040,
        properMotionDecMasYr: -66.920,
        radialVelocityKmS: -13.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALHENA_DEG,
                dec: DEC_ALHENA_DEG
            }
        }
    }
} satisfies StarObj;
