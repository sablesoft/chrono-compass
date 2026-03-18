import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Miaplacidus
const RA_MIAPLACIDUS_DEG = hmsToDeg(9, 13, 12.147600);
const DEC_MIAPLACIDUS_DEG = dmsToDeg(-1, 69, 43, 1.948800);

export const Miaplacidus = {
    id: 'ref:miaplacidus',
    kind: 'star',
    name: 'Miaplacidus',
    description: 'Miaplacidus (ICRF/J2000) — bright star in Carina.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cfddff',
        constellationId: 'ref:constellation:car',
        distancePc: 34.698100,
        apparentMagnitude: 1.67,
        properMotionRaMasYr: -157.660,
        properMotionDecMasYr: 108.910,
        radialVelocityKmS: -5.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIAPLACIDUS_DEG,
                dec: DEC_MIAPLACIDUS_DEG
            }
        }
    }
} satisfies StarObj;
