// src/lib/catalog/objects/mimosa.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mimosa (Beta Crucis)
const RA_MIMOSA_DEG = hmsToDeg(12, 47, 43.26877);
const DEC_MIMOSA_DEG = dmsToDeg(-1, 59, 41, 19.5792);

export const Mimosa = {
    id: 'ref:mimosa',
    kind: 'star',
    name: 'Mimosa',
    description: 'Mimosa (ICRF/J2000) — the second-brightest star in the Southern Cross (Crux), a hot B-type star.',
    emoji: '✦',
    meta: {
        color: '#aabfff',
        constellationId: 'ref:constellation:cru',
        distancePc: 85.3972,
        apparentMagnitude: 1.25,
        properMotionRaMasYr: -48.24,
        properMotionDecMasYr: -12.82,
        radialVelocityKmS: 16,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIMOSA_DEG,
                dec: DEC_MIMOSA_DEG
            }
        }
    }
} satisfies StarObj;
