import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rhombus
const RA_RHOMBUS_DEG = hmsToDeg(4, 14, 25.454400);
const DEC_RHOMBUS_DEG = dmsToDeg(-1, 62, 28, 25.888800);

export const Rhombus = {
    id: 'ref:rhombus',
    kind: 'star',
    name: 'Rhombus',
    description: 'Rhombus (ICRF/J2000) — bright star in Reticulum.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe3cc',
        constellationId: 'ref:constellation:ret',
        distancePc: 49.554000,
        apparentMagnitude: 3.33,
        properMotionRaMasYr: 41.640,
        properMotionDecMasYr: 49.720,
        radialVelocityKmS: 36.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RHOMBUS_DEG,
                dec: DEC_RHOMBUS_DEG
            }
        }
    }
} satisfies StarObj;
