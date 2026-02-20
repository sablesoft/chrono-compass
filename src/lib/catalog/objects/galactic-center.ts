// src/lib/catalog/objects/galactic-center.ts
import type { Obj } from '../types';

export const GalacticCenter = {
    id: 'ref:galactic-center',
    kind: 'reference',
    name: { en: 'Galactic Center', ru: 'Центр Галактики' },
    emoji: '🌀',
    meta: {
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: { ra: 0, dec: 0 }, // константы поставишь позже
        }
    }
} satisfies Obj;
