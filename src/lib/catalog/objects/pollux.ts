import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Pollux
const RA_POLLUX_DEG = hmsToDeg(7, 45, 18.95);
const DEC_POLLUX_DEG = dmsToDeg(1, 28, 1, 34.3);

export const Pollux = {
    id: 'ref:pollux',
    kind: 'reference',
    name: { en: 'Pollux', ru: 'Поллукс' },
    description: {
        en: 'Pollux (ICRF/J2000) — the brightest star in Gemini and one of the classical twin stars.',
        ru: 'Поллукс (ICRF/J2000) — самая яркая звезда Близнецов и одна из классических звёзд-близнецов.'
    },
    emoji: '★',
    meta: {
        color: '#ffd79d',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POLLUX_DEG,
                dec: DEC_POLLUX_DEG
            }
        }
    }
} satisfies Obj;
