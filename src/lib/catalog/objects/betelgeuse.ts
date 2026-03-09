// src/lib/catalog/objects/betelgeuse.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Betelgeuse
const RA_BETELGEUSE_DEG = hmsToDeg(5, 55, 10.3053);
const DEC_BETELGEUSE_DEG = dmsToDeg(1, 7, 24, 25.426);

export const Betelgeuse = {
    id: 'ref:betelgeuse',
    kind: 'reference',
    name: { en: 'Betelgeuse', ru: 'Бетельгейзе' },
    description: {
        en: 'Reference direction toward Betelgeuse (ICRF/J2000), a bright red supergiant in Orion that is famously variable in brightness. This is a fixed line-of-sight vector, not a physical orbit.',
        ru: 'Опорное направление на Бетельгейзе (ICRF/J2000) — яркий красный сверхгигант в Орионе, известный заметной переменностью блеска. Это фиксированный вектор линии визирования, а не физическая орбита.'
    },
    emoji: '★',
    meta: {
        color: '#ffcc6f',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BETELGEUSE_DEG,
                dec: DEC_BETELGEUSE_DEG
            }
        }
    }
} satisfies Obj;
