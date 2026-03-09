// src/lib/catalog/objects/mimosa.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Mimosa (Beta Crucis)
const RA_MIMOSA_DEG = hmsToDeg(12, 47, 43.26877);
const DEC_MIMOSA_DEG = dmsToDeg(-1, 59, 41, 19.5792);

export const Mimosa = {
    id: 'ref:mimosa',
    kind: 'reference',
    name: { en: 'Mimosa', ru: 'Мимоза' },
    description: {
        en: 'Mimosa (ICRF/J2000) — the second-brightest star in the Southern Cross (Crux), a hot B-type star.',
        ru: 'Мимоза (ICRF/J2000) — вторая по яркости звезда Южного Креста (Crux), горячая звезда B-типа.'
    },
    emoji: '★',
    meta: {
        color: '#aabfff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIMOSA_DEG,
                dec: DEC_MIMOSA_DEG
            }
        }
    }
} satisfies Obj;
