import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Cervantes
const RA_CERVANTES_DEG = hmsToDeg(17, 44, 8.707200);
const DEC_CERVANTES_DEG = dmsToDeg(-1, 51, 50, 2.590800);

export const Cervantes = {
    id: 'ref:cervantes',
    kind: 'star',
    name: 'Cervantes',
    description: 'Cervantes (ICRF/J2000) — bright star in Ara.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff0e2',
        constellationId: 'ref:constellation:ara',
        distancePc: 15.511100,
        apparentMagnitude: 5.12,
        properMotionRaMasYr: -15.060,
        properMotionDecMasYr: -191.170,
        radialVelocityKmS: -9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CERVANTES_DEG,
                dec: DEC_CERVANTES_DEG
            }
        }
    }
} satisfies StarObj;
