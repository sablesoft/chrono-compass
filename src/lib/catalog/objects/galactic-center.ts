// src/lib/catalog/objects/galactic-center.ts
import {dmsToDeg, hmsToDeg, type Obj} from '../types';

// ICRS / J2000 approx coordinates of Galactic Center
const RA_GC_DEG  = hmsToDeg(17, 45, 40.04);
const DEC_GC_DEG = dmsToDeg(-1, 29, 0, 28.1);

export const GalacticCenter = {
    id: 'ref:galactic-center',
    kind: 'reference',
    name: { en: 'Galactic' },
    emoji: '🌀',
    meta: {
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GC_DEG,
                dec: DEC_GC_DEG,
            },
        }
    }
} satisfies Obj;
