import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Avior
const RA_AVIOR_DEG = hmsToDeg(8, 22, 30.8);
const DEC_AVIOR_DEG = dmsToDeg(-1, 59, 30, 35.0);

export const Avior = {
    id: 'ref:avior',
    kind: 'star',
    name: 'Avior',
    description: 'Avior (ICRF/J2000) — a bright southern star in Carina, widely recognized in navigational traditions.',
    emoji: '✦',
    meta: {
        color: '#ffe0b5',
        constellationId: 'ref:constellation:car',
        distancePc: 185.5287,
        apparentMagnitude: 1.86,
        properMotionRaMasYr: -25.34,
        properMotionDecMasYr: 22.72,
        radialVelocityKmS: 2,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_AVIOR_DEG,
                dec: DEC_AVIOR_DEG
            }
        }
    }
} satisfies StarObj;
