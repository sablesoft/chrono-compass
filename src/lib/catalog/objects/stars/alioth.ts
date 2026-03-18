import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alioth
const RA_ALIOTH_DEG = hmsToDeg(12, 54, 1.699200);
const DEC_ALIOTH_DEG = dmsToDeg(1, 55, 57, 35.355600);

export const Alioth = {
    id: 'ref:alioth',
    kind: 'star',
    name: 'Alioth',
    description: 'Alioth (ICRF/J2000) — bright star in Ursa Major.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c7d8ff',
        constellationId: 'ref:constellation:uma',
        distancePc: 25.310000,
        apparentMagnitude: 1.76,
        properMotionRaMasYr: 111.740,
        properMotionDecMasYr: -8.990,
        radialVelocityKmS: -9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALIOTH_DEG,
                dec: DEC_ALIOTH_DEG
            }
        }
    }
} satisfies StarObj;
