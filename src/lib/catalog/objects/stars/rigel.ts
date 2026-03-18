import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rigel
const RA_RIGEL_DEG = hmsToDeg(5, 14, 32.272800);
const DEC_RIGEL_DEG = dmsToDeg(-1, 8, 12, 5.904000);

export const Rigel = {
    id: 'ref:rigel',
    kind: 'star',
    name: 'Rigel',
    description: 'Rigel (ICRF/J2000) — bright star in Orion.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c6d8ff',
        constellationId: 'ref:constellation:ori',
        distancePc: 264.550300,
        apparentMagnitude: 0.18,
        properMotionRaMasYr: 1.870,
        properMotionDecMasYr: -0.560,
        radialVelocityKmS: 21.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RIGEL_DEG,
                dec: DEC_RIGEL_DEG
            }
        }
    }
} satisfies StarObj;
