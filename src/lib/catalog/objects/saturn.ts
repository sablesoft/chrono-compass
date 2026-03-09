// src/lib/catalog/objects/Saturn.ts
import type { Obj } from '../types';

export const Saturn: Obj = {
    id: 'Saturn',
    kind: 'engine_body',
    name: { en: 'Saturn' },
    description: {
        en: 'A gas giant with a prominent ring system, easily recognizable in telescopes.',
        ru: 'Газовый гигант с яркой системой колец, легко узнаваемый в телескоп.'
    },
    meta: {
        color: '#c9b37e'
    },
    emoji: '♄'
};
