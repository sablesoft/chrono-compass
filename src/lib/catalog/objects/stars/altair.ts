// src/lib/catalog/objects/altair.ts
import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Altair
const RA_ALTAIR_DEG = hmsToDeg(19, 50, 47);
const DEC_ALTAIR_DEG = dmsToDeg(1, 8, 52, 5);

export const Altair = {
    id: 'ref:altair',
    kind: 'star',
    name: 'Altair',
    description: 'Altair (ICRF/J2000) — the brightest star in Aquila and a vertex of the Summer Triangle.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cad7ff',
        constellationId: 'ref:constellation:aql',
        distancePc: 5.1294,
        apparentMagnitude: 0.76,
        properMotionRaMasYr: 536.82,
        properMotionDecMasYr: 385.54,
        radialVelocityKmS: -26.1,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALTAIR_DEG,
                dec: DEC_ALTAIR_DEG
            }
        }
    }
} satisfies StarObj;
