import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alpherg
const RA_ALPHERG_DEG = hmsToDeg(1, 31, 29.010000);
const DEC_ALPHERG_DEG = dmsToDeg(1, 15, 20, 44.962800);

export const Alpherg = {
    id: 'ref:alpherg',
    kind: 'star',
    name: 'Alpherg',
    description: 'Alpherg (ICRF/J2000) — bright star in Pisces.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe0c7',
        constellationId: 'ref:constellation:psc',
        distancePc: 107.181100,
        apparentMagnitude: 3.62,
        properMotionRaMasYr: 25.730,
        properMotionDecMasYr: -3.290,
        radialVelocityKmS: 15.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALPHERG_DEG,
                dec: DEC_ALPHERG_DEG
            }
        }
    }
} satisfies StarObj;
