import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Wezen
const RA_WEZEN_DEG = hmsToDeg(7, 8, 23.485200);
const DEC_WEZEN_DEG = dmsToDeg(-1, 26, 23, 35.520000);

export const Wezen = {
    id: 'ref:wezen',
    kind: 'star',
    name: 'Wezen',
    description: 'Wezen (ICRF/J2000) — bright star in Canis Major.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff1e4',
        constellationId: 'ref:constellation:cma',
        distancePc: 492.610800,
        apparentMagnitude: 1.83,
        properMotionRaMasYr: -2.750,
        properMotionDecMasYr: 3.330,
        radialVelocityKmS: 34.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_WEZEN_DEG,
                dec: DEC_WEZEN_DEG
            }
        }
    }
} satisfies StarObj;
