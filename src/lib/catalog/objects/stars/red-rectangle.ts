import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Red Rectangle
const RA_REDRECTANGLE_DEG = hmsToDeg(6, 19, 58.216800);
const DEC_REDRECTANGLE_DEG = dmsToDeg(-1, 10, 38, 14.690400);

export const RedRectangle = {
    id: 'ref:red-rectangle',
    kind: 'star',
    name: 'Red Rectangle',
    description: 'Red Rectangle (ICRF/J2000) — bright star in Monoceros.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#edefff',
        constellationId: 'ref:constellation:mon',
        distancePc: 440.528600,
        apparentMagnitude: 8.85,
        properMotionRaMasYr: -10.980,
        properMotionDecMasYr: -21.100,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_REDRECTANGLE_DEG,
                dec: DEC_REDRECTANGLE_DEG
            }
        }
    }
} satisfies StarObj;
