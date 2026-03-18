// src/lib/catalog/objects/sirius.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sirius
const RA_SIRIUS_DEG = hmsToDeg(6, 45, 8.917);
const DEC_SIRIUS_DEG = dmsToDeg(-1, 16, 42, 58.11);

export const Sirius = {
    id: 'ref:sirius',
    kind: 'star',
    name: 'Sirius',
    description: 'Sirius (ICRF/J2000) — the brightest star in the night sky and the “Dog Star” of Canis Major.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cad7ff',
        constellationId: 'ref:constellation:cma',
        distancePc: 2.6371,
        apparentMagnitude: -1.44,
        properMotionRaMasYr: -546.01,
        properMotionDecMasYr: -1223.08,
        radialVelocityKmS: -9.4,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SIRIUS_DEG,
                dec: DEC_SIRIUS_DEG
            }
        }
    }
} satisfies StarObj;
