import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alcyone
const RA_ALCYONE_DEG = hmsToDeg(3, 47, 29.076000);
const DEC_ALCYONE_DEG = dmsToDeg(1, 24, 6, 18.493200);

export const Alcyone = {
    id: 'ref:alcyone',
    kind: 'star',
    name: 'Alcyone',
    description: 'Alcyone (ICRF/J2000) — bright star in Taurus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c2d5ff',
        constellationId: 'ref:constellation:tau',
        distancePc: 123.609400,
        apparentMagnitude: 2.85,
        properMotionRaMasYr: 19.350,
        properMotionDecMasYr: -43.110,
        radialVelocityKmS: 10.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALCYONE_DEG,
                dec: DEC_ALCYONE_DEG
            }
        }
    }
} satisfies StarObj;
