import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Skat
const RA_SKAT_DEG = hmsToDeg(22, 54, 39.013200);
const DEC_SKAT_DEG = dmsToDeg(-1, 15, 49, 14.952000);

export const Skat = {
    id: 'ref:skat',
    kind: 'star',
    name: 'Skat',
    description: 'Skat (ICRF/J2000) — bright star in Aquarius.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ceddff',
        constellationId: 'ref:constellation:aqr',
        distancePc: 49.236800,
        apparentMagnitude: 3.27,
        properMotionRaMasYr: -44.080,
        properMotionDecMasYr: -24.810,
        radialVelocityKmS: 18.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SKAT_DEG,
                dec: DEC_SKAT_DEG
            }
        }
    }
} satisfies StarObj;
