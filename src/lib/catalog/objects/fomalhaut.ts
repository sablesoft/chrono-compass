import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Fomalhaut
const RA_FOMALHAUT_DEG = hmsToDeg(22, 57, 39.1);
const DEC_FOMALHAUT_DEG = dmsToDeg(-1, 29, 37, 20.0);

export const Fomalhaut = {
    id: 'ref:fomalhaut',
    kind: 'reference',
    name: { en: 'Fomalhaut', ru: 'Фомальгаут' },
    description: {
        en: 'Fomalhaut (ICRF/J2000) — Alpha Piscis Austrini, one of the brightest solitary stars and a major royal star in many traditions.',
        ru: 'Фомальгаут (ICRF/J2000) — Альфа Южной Рыбы, одна из самых ярких одиноких звёзд и важная царская звезда во многих традициях.'
    },
    emoji: '★',
    meta: {
        color: '#dff5ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_FOMALHAUT_DEG,
                dec: DEC_FOMALHAUT_DEG
            }
        }
    }
} satisfies Obj;
