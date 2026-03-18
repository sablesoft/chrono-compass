import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Cih
const RA_CIH_DEG = hmsToDeg(0, 56, 42.514800);
const DEC_CIH_DEG = dmsToDeg(1, 60, 43, 0.264000);

export const Cih = {
    id: 'ref:cih',
    kind: 'star',
    name: 'Cih',
    description: 'Cih (ICRF/J2000) — bright star in Cassiopeia.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c5d7ff',
        constellationId: 'ref:constellation:cas',
        distancePc: 168.350200,
        apparentMagnitude: 2.15,
        properMotionRaMasYr: 25.650,
        properMotionDecMasYr: -3.820,
        radialVelocityKmS: -7.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CIH_DEG,
                dec: DEC_CIH_DEG
            }
        }
    }
} satisfies StarObj;
