// src/lib/catalog/objects/altair.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Altair
const RA_ALTAIR_DEG = hmsToDeg(19, 50, 47);
const DEC_ALTAIR_DEG = dmsToDeg(1, 8, 52, 5);

export const Altair = {
    id: 'ref:altair',
    kind: 'reference',
    name: { en: 'Altair', ru: 'Альтаир' },
    description: {
        en: 'Altair (ICRF/J2000) — the brightest star in Aquila and a vertex of the Summer Triangle.',
        ru: 'Альтаир (ICRF/J2000) — самая яркая звезда Орла и вершина Летнего треугольника.'
    },
    emoji: '★',
    meta: {
        color: '#cad7ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALTAIR_DEG,
                dec: DEC_ALTAIR_DEG
            }
        }
    }
} satisfies Obj;
