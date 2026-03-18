import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sarin
const RA_SARIN_DEG = hmsToDeg(17, 15, 1.911600);
const DEC_SARIN_DEG = dmsToDeg(1, 24, 50, 21.134400);

export const Sarin = {
    id: 'ref:sarin',
    kind: 'star',
    name: 'Sarin',
    description: 'Sarin (ICRF/J2000) — bright star in Hercules.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d0deff',
        constellationId: 'ref:constellation:her',
        distancePc: 23.036200,
        apparentMagnitude: 3.12,
        properMotionRaMasYr: -21.140,
        properMotionDecMasYr: -157.680,
        radialVelocityKmS: -40.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SARIN_DEG,
                dec: DEC_SARIN_DEG
            }
        }
    }
} satisfies StarObj;
