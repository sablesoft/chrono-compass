import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Shaula
const RA_SHAULA_DEG = hmsToDeg(17, 33, 36.5);
const DEC_SHAULA_DEG = dmsToDeg(-1, 37, 6, 13.0);

export const Shaula = {
    id: 'ref:shaula',
    kind: 'reference',
    name: { en: 'Shaula', ru: 'Шаула' },
    description: {
        en: 'Shaula (ICRF/J2000) — one of the bright tail stars of Scorpius and a striking southern blue star.',
        ru: 'Шаула (ICRF/J2000) — одна из ярких хвостовых звёзд Скорпиона и заметная южная голубая звезда.'
    },
    emoji: '★',
    meta: {
        color: '#cfe0ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SHAULA_DEG,
                dec: DEC_SHAULA_DEG
            }
        }
    }
} satisfies Obj;
