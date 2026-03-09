// src/lib/catalog/objects/Jupiter.ts
import type { Obj } from '../types';

export const Jupiter: Obj = {
    id: 'Jupiter',
    kind: 'engine_body',
    name: { en: 'Jupiter' },
    description: {
        en: 'The largest planet, a gas giant famous for its Great Red Spot.',
        ru: 'Самая крупная планета, газовый гигант с известным Большим красным пятном.'
    },
    meta: {
        color: '#d2a679'
    },
    emoji: '♃'
};
