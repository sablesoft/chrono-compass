import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Nenque
const RA_NENQUE_DEG = hmsToDeg(1, 4, 40.180800);
const DEC_NENQUE_DEG = dmsToDeg(-1, 39, 29, 17.581200);

export const Nenque = {
    id: 'ref:nenque',
    kind: 'star',
    name: 'Nenque',
    description: 'Nenque (ICRF/J2000) — bright star in Phoenix.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff5eb',
        constellationId: 'ref:constellation:phe',
        distancePc: 41.373600,
        apparentMagnitude: 7.72,
        properMotionRaMasYr: -168.970,
        properMotionDecMasYr: -527.710,
        radialVelocityKmS: 22.400,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_NENQUE_DEG,
                dec: DEC_NENQUE_DEG
            }
        }
    }
} satisfies StarObj;
