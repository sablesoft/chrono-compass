import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Menkalinan
const RA_MENKALINAN_DEG = hmsToDeg(5, 59, 31.736400);
const DEC_MENKALINAN_DEG = dmsToDeg(1, 44, 56, 50.758800);

export const Menkalinan = {
    id: 'ref:menkalinan',
    kind: 'star',
    name: 'Menkalinan',
    description: 'Menkalinan (ICRF/J2000) — bright star in Auriga.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cfddff',
        constellationId: 'ref:constellation:aur',
        distancePc: 24.869400,
        apparentMagnitude: 1.90,
        properMotionRaMasYr: -56.410,
        properMotionDecMasYr: -0.880,
        radialVelocityKmS: -19.400,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MENKALINAN_DEG,
                dec: DEC_MENKALINAN_DEG
            }
        }
    }
} satisfies StarObj;
