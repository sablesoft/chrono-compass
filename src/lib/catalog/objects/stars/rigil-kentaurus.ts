import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rigil Kentaurus
const RA_RIGILKENTAURUS_DEG = hmsToDeg(14, 39, 38.754000);
const DEC_RIGILKENTAURUS_DEG = dmsToDeg(-1, 60, 50, 2.313600);

export const RigilKentaurus = {
    id: 'ref:rigil-kentaurus',
    kind: 'star',
    name: 'Rigil Kentaurus',
    description: 'Rigil Kentaurus (ICRF/J2000) — bright star in Centaurus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffefe0',
        constellationId: 'ref:constellation:cen',
        distancePc: 1.324800,
        apparentMagnitude: -0.01,
        properMotionRaMasYr: -3678.190,
        properMotionDecMasYr: 481.840,
        radialVelocityKmS: -26.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RIGILKENTAURUS_DEG,
                dec: DEC_RIGILKENTAURUS_DEG
            }
        }
    }
} satisfies StarObj;
