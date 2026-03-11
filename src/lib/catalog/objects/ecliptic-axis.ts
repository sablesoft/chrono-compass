// src/lib/catalog/objects/ecliptic-axis.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// North ecliptic pole (J2000), approximately.
const RA_ECL_NORTH_DEG = hmsToDeg(18, 0, 0);
const DEC_ECL_NORTH_DEG = dmsToDeg(1, 66, 33, 38.6);

export const EclipticAxis = {
    id: 'ref:ecliptic-axis',
    kind: 'reference',
    name: 'Ecliptic Axis',
    description: 'Reference direction of the north ecliptic pole in ICRF/J2000. This defines the ecliptic-plane normal as a fixed axis, not a physical body.',
    emoji: '🧭',
    meta: {
        color: '#9aa3ad',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ECL_NORTH_DEG,
                dec: DEC_ECL_NORTH_DEG,
            },
        }
    }
} satisfies Obj;
