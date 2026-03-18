// src/lib/catalog/objects/gacrux.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Gacrux (Gamma Crucis)
const RA_GACRUX_DEG = hmsToDeg(12, 31, 9.95961);
const DEC_GACRUX_DEG = dmsToDeg(-1, 57, 6, 47.5684);

export const Gacrux = {
    id: 'ref:gacrux',
    kind: 'star',
    name: 'Gacrux',
    description: 'Gacrux (ICRF/J2000), the red giant at the top of the Southern Cross (Crux), a cool M-type star.',
    emoji: '✦',
    meta: {
        color: '#ffcc6f',
        constellationId: 'ref:constellation:cru',
        distancePc: 27.1517,
        apparentMagnitude: 1.59,
        properMotionRaMasYr: 27.94,
        properMotionDecMasYr: -264.33,
        radialVelocityKmS: 21,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GACRUX_DEG,
                dec: DEC_GACRUX_DEG
            }
        }
    }
} satisfies StarObj;
