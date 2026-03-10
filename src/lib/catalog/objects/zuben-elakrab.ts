import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Zuben Elakrab
const RA_ZUBEN_ELAKRAB_DEG = hmsToDeg(15, 0, 58.3);
const DEC_ZUBEN_ELAKRAB_DEG = dmsToDeg(-1, 16, 1, 30.0);

export const ZubenElakrab = {
    id: 'ref:zuben-elakrab',
    kind: 'reference',
    name: { en: 'Zuben Elakrab', ru: 'Зубен Элакраб' },
    description: {
        en: 'Zuben Elakrab (ICRF/J2000) — Gamma Librae, a traditional southern scale star linked with the extended claws and balances of Libra.',
        ru: 'Зубен Элакраб (ICRF/J2000) — Гамма Весов, традиционная южная звезда чаши, связанная с расширенными клешнями и весами в старых традициях.'
    },
    emoji: '★',
    meta: {
        color: '#c9dfff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ZUBEN_ELAKRAB_DEG,
                dec: DEC_ZUBEN_ELAKRAB_DEG
            }
        }
    }
} satisfies Obj;
