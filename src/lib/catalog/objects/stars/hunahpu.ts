import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Hunahpú
const RA_HUNAHPU_DEG = hmsToDeg(11, 17, 47.558400);
const DEC_HUNAHPU_DEG = dmsToDeg(-1, 23, 58, 31.490400);

export const Hunahpu = {
    id: 'ref:hunahpu',
    kind: 'star',
    name: 'Hunahpú',
    description: 'Hunahpú (ICRF/J2000) — bright star in Crater.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe1c8',
        constellationId: 'ref:constellation:crt',
        distancePc: 134.228200,
        apparentMagnitude: 8.05,
        properMotionRaMasYr: -131.110,
        properMotionDecMasYr: -16.250,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HUNAHPU_DEG,
                dec: DEC_HUNAHPU_DEG
            }
        }
    }
} satisfies StarObj;
