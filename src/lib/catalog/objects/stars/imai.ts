// src/lib/catalog/objects/imai.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Imai (Delta Crucis)
const RA_IMAI_DEG = hmsToDeg(12, 15, 8.71673);
const DEC_IMAI_DEG = dmsToDeg(-1, 58, 44, 56.1369);

export const Imai = {
    id: 'ref:imai',
    kind: 'star',
    name: 'Imai',
    description: 'Imai (ICRF/J2000) — the bright Delta Crucis star in the Southern Cross (Crux), a B-type star.',
    emoji: '✦',
    meta: {
        color: '#aabfff',
        constellationId: 'ref:constellation:cru',
        distancePc: 105.8202,
        apparentMagnitude: 2.79,
        properMotionRaMasYr: -36.68,
        properMotionDecMasYr: -10.72,
        radialVelocityKmS: 22,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_IMAI_DEG,
                dec: DEC_IMAI_DEG
            }
        }
    }
} satisfies StarObj;
