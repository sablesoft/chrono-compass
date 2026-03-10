import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Hadar
const RA_HADAR_DEG = hmsToDeg(14, 3, 49.4);
const DEC_HADAR_DEG = dmsToDeg(-1, 60, 22, 23.0);

export const Hadar = {
    id: 'ref:hadar',
    kind: 'reference',
    name: { en: 'Hadar', ru: 'Хадар' },
    description: {
        en: 'Hadar (ICRF/J2000) — Beta Centauri, one of the brightest southern stars and a major navigational companion to the Southern Cross.',
        ru: 'Хадар (ICRF/J2000) — Бета Центавра, одна из самых ярких южных звёзд и важный навигационный ориентир рядом с Южным Крестом.'
    },
    emoji: '★',
    meta: {
        color: '#cfe0ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HADAR_DEG,
                dec: DEC_HADAR_DEG
            }
        }
    }
} satisfies Obj;
