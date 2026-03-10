import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Castor
const RA_CASTOR_DEG = hmsToDeg(7, 34, 36.0);
const DEC_CASTOR_DEG = dmsToDeg(1, 31, 53, 18.0);

export const Castor = {
    id: 'ref:castor',
    kind: 'reference',
    name: { en: 'Castor', ru: 'Кастор' },
    description: {
        en: 'Castor (ICRF/J2000) — the second bright twin of Gemini and a famous naked-eye multiple-star system.',
        ru: 'Кастор (ICRF/J2000) — вторая яркая звезда Близнецов и известная кратная звёздная система, видимая невооружённым глазом.'
    },
    emoji: '★',
    meta: {
        color: '#e8ebff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CASTOR_DEG,
                dec: DEC_CASTOR_DEG
            }
        }
    }
} satisfies Obj;
