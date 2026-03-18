import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tengshe
const RA_TENGSHE_DEG = hmsToDeg(22, 56, 25.998000);
const DEC_TENGSHE_DEG = dmsToDeg(1, 49, 44, 0.758400);

export const Tengshe = {
    id: 'ref:tengshe',
    kind: 'star',
    name: 'Tengshe',
    description: 'Tengshe (ICRF/J2000) — bright star in Lacerta.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffbe88',
        constellationId: 'ref:constellation:lac',
        distancePc: 490.196100,
        apparentMagnitude: 4.99,
        properMotionRaMasYr: 0.050,
        properMotionDecMasYr: -2.870,
        radialVelocityKmS: -10.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TENGSHE_DEG,
                dec: DEC_TENGSHE_DEG
            }
        }
    }
} satisfies StarObj;
