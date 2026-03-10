import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Sabik
const RA_SABIK_DEG = hmsToDeg(17, 10, 22.7);
const DEC_SABIK_DEG = dmsToDeg(-1, 15, 43, 30.0);

export const Sabik = {
    id: 'ref:sabik',
    kind: 'reference',
    name: { en: 'Sabik', ru: 'Сабик' },
    description: {
        en: 'Sabik (ICRF/J2000) — Eta Ophiuchi, a bright star in Ophiuchus traditionally associated with the Serpent Bearer’s lower figure.',
        ru: 'Сабик (ICRF/J2000) — Эта Змееносца, яркая звезда созвездия Змееносца, традиционно связанная с нижней частью фигуры Змееносца.'
    },
    emoji: '★',
    meta: {
        color: '#e6edff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SABIK_DEG,
                dec: DEC_SABIK_DEG
            }
        }
    }
} satisfies Obj;
