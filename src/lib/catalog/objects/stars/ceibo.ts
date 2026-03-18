import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Ceibo
const RA_CEIBO_DEG = hmsToDeg(7, 39, 21.898800);
const DEC_CEIBO_DEG = dmsToDeg(-1, 78, 16, 44.299200);

export const Ceibo = {
    id: 'ref:ceibo',
    kind: 'star',
    name: 'Ceibo',
    description: 'Ceibo (ICRF/J2000) — bright star in Chamaeleon.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdec4',
        constellationId: 'ref:constellation:cha',
        distancePc: 34.542300,
        apparentMagnitude: 9.37,
        properMotionRaMasYr: -20.650,
        properMotionDecMasYr: -39.690,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CEIBO_DEG,
                dec: DEC_CEIBO_DEG
            }
        }
    }
} satisfies StarObj;
