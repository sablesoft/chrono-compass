import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Aldhanab
const RA_ALDHANAB_DEG = hmsToDeg(21, 53, 55.708800);
const DEC_ALDHANAB_DEG = dmsToDeg(-1, 37, 21, 53.467200);

export const Aldhanab = {
    id: 'ref:aldhanab',
    kind: 'star',
    name: 'Aldhanab',
    description: 'Aldhanab (ICRF/J2000) — bright star in Grus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c2d5ff',
        constellationId: 'ref:constellation:gru',
        distancePc: 64.724900,
        apparentMagnitude: 3.00,
        properMotionRaMasYr: 95.880,
        properMotionDecMasYr: -12.100,
        radialVelocityKmS: -2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALDHANAB_DEG,
                dec: DEC_ALDHANAB_DEG
            }
        }
    }
} satisfies StarObj;
