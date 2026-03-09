// src/lib/catalog/objects/antares.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Antares
const RA_ANTARES_DEG = hmsToDeg(16, 29, 24.9);
const DEC_ANTARES_DEG = dmsToDeg(-1, 26, 25, 55);

export const Antares = {
    id: 'ref:antares',
    kind: 'reference',
    name: { en: 'Antares', ru: 'Антарес' },
    description: {
        en: 'Reference direction toward Antares (ICRF/J2000), a red supergiant and the brightest star in Scorpius, often called the “heart of the scorpion”. This is a fixed line-of-sight vector, not a physical orbit.',
        ru: 'Опорное направление на Антарес (ICRF/J2000) — красный сверхгигант и самая яркая звезда Скорпиона, часто называемая «сердцем Скорпиона». Это фиксированный вектор линии визирования, а не физическая орбита.'
    },
    emoji: '★',
    meta: {
        color: '#ffcc6f',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ANTARES_DEG,
                dec: DEC_ANTARES_DEG
            }
        }
    }
} satisfies Obj;
