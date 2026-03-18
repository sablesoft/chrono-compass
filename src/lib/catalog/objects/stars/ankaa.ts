import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Ankaa
const RA_ANKAA_DEG = hmsToDeg(0, 26, 17.001600);
const DEC_ANKAA_DEG = dmsToDeg(-1, 42, 18, 21.531600);

export const Ankaa = {
    id: 'ref:ankaa',
    kind: 'star',
    name: 'Ankaa',
    description: 'Ankaa (ICRF/J2000) — bright star in Phoenix.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdbbd',
        constellationId: 'ref:constellation:phe',
        distancePc: 25.974000,
        apparentMagnitude: 2.40,
        properMotionRaMasYr: 232.760,
        properMotionDecMasYr: -353.640,
        radialVelocityKmS: 75.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ANKAA_DEG,
                dec: DEC_ANKAA_DEG
            }
        }
    }
} satisfies StarObj;
