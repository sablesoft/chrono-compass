// src/lib/catalog/objects/polaris.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Polaris
const RA_POLARIS_DEG = hmsToDeg(2, 31, 48.7);
const DEC_POLARIS_DEG = dmsToDeg(1, 89, 15, 51);

export const Polaris = {
    id: 'ref:polaris',
    kind: 'reference',
    name: { en: 'Polaris', ru: 'Полярная звезда' },
    description: {
        en: 'Reference direction toward Polaris (ICRF/J2000), the North Star in Ursa Minor, located close to the north celestial pole and used for navigation. This is a fixed line-of-sight vector, not a physical orbit.',
        ru: 'Опорное направление на Полярную звезду (ICRF/J2000) в созвездии Малой Медведицы, близкую к северному полюсу мира и традиционно используемую для навигации. Это фиксированный вектор линии визирования, а не физическая орбита.'
    },
    emoji: '★',
    meta: {
        color: '#f8f7ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POLARIS_DEG,
                dec: DEC_POLARIS_DEG
            }
        }
    }
} satisfies Obj;
