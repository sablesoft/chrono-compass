import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Algol
const RA_ALGOL_DEG = hmsToDeg(3, 8, 10.132800);
const DEC_ALGOL_DEG = dmsToDeg(1, 40, 57, 20.332800);

export const Algol = {
    id: 'ref:algol',
    kind: 'star',
    name: 'Algol',
    description: 'Algol (ICRF/J2000) — bright star in Perseus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c9d9ff',
        constellationId: 'ref:constellation:per',
        distancePc: 27.571000,
        apparentMagnitude: 2.09,
        properMotionRaMasYr: 2.390,
        properMotionDecMasYr: -1.440,
        radialVelocityKmS: 4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALGOL_DEG,
                dec: DEC_ALGOL_DEG
            }
        }
    }
} satisfies StarObj;
