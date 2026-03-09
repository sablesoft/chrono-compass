// src/lib/catalog/objects/Mars.ts
import type { Obj } from '../types';

export const Mars: Obj = {
    id: 'Mars',
    kind: 'engine_body',
    name: { en: 'Mars' },
    description: {
        en: 'The red planet, known for its reddish hue and polar ice caps.',
        ru: 'Красная планета, известная своим красноватым цветом и полярными шапками.'
    },
    meta: {
        color: '#d94b3d'
    },
    emoji: '♂️'
};
