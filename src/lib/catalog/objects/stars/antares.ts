// src/lib/catalog/objects/antares.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Antares
const RA_ANTARES_DEG = hmsToDeg(16, 29, 24.9);
const DEC_ANTARES_DEG = dmsToDeg(-1, 26, 25, 55);

export const Antares = {
    id: 'ref:antares',
    kind: 'star',
    name: 'Antares',
    description: 'Antares (ICRF/J2000) - a red supergiant and the brightest star in Scorpius, often called the “heart of the scorpion”.',
    emoji: '✦',
    meta: {
        color: '#ffcc6f',
        constellationId: 'ref:constellation:sco',
        distancePc: 169.7792,
        apparentMagnitude: 1.06,
        properMotionRaMasYr: -10.16,
        properMotionDecMasYr: -23.21,
        radialVelocityKmS: -3,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ANTARES_DEG,
                dec: DEC_ANTARES_DEG
            }
        }
    }
} satisfies StarObj;
