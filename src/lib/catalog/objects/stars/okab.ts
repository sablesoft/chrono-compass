import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Okab
const RA_OKAB_DEG = hmsToDeg(19, 5, 24.608400);
const DEC_OKAB_DEG = dmsToDeg(1, 13, 51, 48.520800);

export const Okab = {
    id: 'ref:okab',
    kind: 'star',
    name: 'Okab',
    description: 'Okab (ICRF/J2000) — bright star in Aquila.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cadaff',
        constellationId: 'ref:constellation:aql',
        distancePc: 25.458200,
        apparentMagnitude: 2.99,
        properMotionRaMasYr: -7.040,
        properMotionDecMasYr: -95.310,
        radialVelocityKmS: -25.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_OKAB_DEG,
                dec: DEC_OKAB_DEG
            }
        }
    }
} satisfies StarObj;
