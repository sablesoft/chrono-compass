import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Markab
const RA_MARKAB_DEG = hmsToDeg(23, 4, 45.7);
const DEC_MARKAB_DEG = dmsToDeg(1, 15, 12, 19.0);

export const Markab = {
    id: 'ref:markab',
    kind: 'reference',
    name: { en: 'Markab', ru: 'Маркаб' },
    description: {
        en: 'Markab (ICRF/J2000) — one of the defining stars of the Great Square of Pegasus.',
        ru: 'Маркаб (ICRF/J2000) — одна из определяющих звёзд Большого квадрата Пегаса.'
    },
    emoji: '★',
    meta: {
        color: '#dde5ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MARKAB_DEG,
                dec: DEC_MARKAB_DEG
            }
        }
    }
} satisfies Obj;
