import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Markab
const RA_MARKAB_DEG = hmsToDeg(23, 4, 45.7);
const DEC_MARKAB_DEG = dmsToDeg(1, 15, 12, 19.0);

export const Markab = {
    id: 'ref:markab',
    kind: 'star',
    name: 'Markab',
    description: 'Markab (ICRF/J2000) — one of the defining stars of the Great Square of Pegasus.',
    emoji: '✦',
    meta: {
        color: '#dde5ff',
        constellationId: 'ref:constellation:peg',
        distancePc: 40.8832,
        apparentMagnitude: 2.49,
        properMotionRaMasYr: 61.1,
        properMotionDecMasYr: -42.56,
        radialVelocityKmS: -4,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MARKAB_DEG,
                dec: DEC_MARKAB_DEG
            }
        }
    }
} satisfies StarObj;
