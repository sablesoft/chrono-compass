import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Sargas
const RA_SARGAS_DEG = hmsToDeg(17, 37, 19.1);
const DEC_SARGAS_DEG = dmsToDeg(-1, 42, 59, 52.0);

export const Sargas = {
    id: 'ref:sargas',
    kind: 'reference',
    name: { en: 'Sargas', ru: 'Саргас' },
    description: {
        en: 'Sargas (ICRF/J2000) — Theta Scorpii, a bright southern star in the Scorpion often used as a marker of its curving tail region.',
        ru: 'Саргас (ICRF/J2000) — Тета Скорпиона, яркая южная звезда Скорпиона, часто служащая маркером его изогнутой хвостовой области.'
    },
    emoji: '★',
    meta: {
        color: '#ffe1b8',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SARGAS_DEG,
                dec: DEC_SARGAS_DEG
            }
        }
    }
} satisfies Obj;
