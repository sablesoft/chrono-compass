import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Intan
const RA_INTAN_DEG = hmsToDeg(3, 20, 42.658800);
const DEC_INTAN_DEG = dmsToDeg(-1, 33, 43, 48.374400);

export const Intan = {
    id: 'ref:intan',
    kind: 'star',
    name: 'Intan',
    description: 'Intan (ICRF/J2000) — bright star in Fornax.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffddc1',
        constellationId: 'ref:constellation:for',
        distancePc: 46.210700,
        apparentMagnitude: 9.92,
        properMotionRaMasYr: 293.780,
        properMotionDecMasYr: 95.990,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_INTAN_DEG,
                dec: DEC_INTAN_DEG
            }
        }
    }
} satisfies StarObj;
