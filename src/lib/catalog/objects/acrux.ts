// src/lib/catalog/objects/acrux.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Acrux (Alpha Crucis)
const RA_ACRUX_DEG = hmsToDeg(12, 26, 35.89522);
const DEC_ACRUX_DEG = dmsToDeg(-1, 63, 5, 56.7343);

export const Acrux = {
    id: 'ref:acrux',
    kind: 'reference',
    name: 'Acrux',
    description: 'Acrux (ICRF/J2000) — the brightest star of the Southern Cross (Crux), a blue B-type system.',
    emoji: '✶',
    meta: {
        color: '#aabfff',
        distancePc: 98.7166,
        apparentMagnitude: 0.77,
        properMotionRaMasYr: -35.37,
        properMotionDecMasYr: -14.73,
        radialVelocityKmS: -11,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACRUX_DEG,
                dec: DEC_ACRUX_DEG
            }
        }
    }
} satisfies Obj;
