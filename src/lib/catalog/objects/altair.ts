// src/lib/catalog/objects/altair.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Altair
const RA_ALTAIR_DEG = hmsToDeg(19, 50, 47);
const DEC_ALTAIR_DEG = dmsToDeg(1, 8, 52, 5);

export const Altair = {
    id: 'ref:altair',
    kind: 'reference',
    name: 'Altair',
    description: 'Altair (ICRF/J2000) — the brightest star in Aquila and a vertex of the Summer Triangle.',
    emoji: '✶',
    meta: {
        color: '#cad7ff',
        distancePc: 5.1294,
        apparentMagnitude: 0.76,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALTAIR_DEG,
                dec: DEC_ALTAIR_DEG
            }
        }
    }
} satisfies Obj;
