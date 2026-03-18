import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Brachium
const RA_BRACHIUM_DEG = hmsToDeg(15, 4, 4.220400);
const DEC_BRACHIUM_DEG = dmsToDeg(-1, 25, 16, 55.074000);

export const Brachium = {
    id: 'ref:brachium',
    kind: 'star',
    name: 'Brachium',
    description: 'Brachium (ICRF/J2000) — bright star in Libra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc290',
        constellationId: 'ref:constellation:lib',
        distancePc: 88.417300,
        apparentMagnitude: 3.25,
        properMotionRaMasYr: -71.850,
        properMotionDecMasYr: -44.690,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BRACHIUM_DEG,
                dec: DEC_BRACHIUM_DEG
            }
        }
    }
} satisfies StarObj;
