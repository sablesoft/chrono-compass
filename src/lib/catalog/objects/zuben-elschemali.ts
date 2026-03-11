import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Zuben Elschemali
const RA_ZUBEN_ELSCHEMALI_DEG = hmsToDeg(15, 17, 0.4);
const DEC_ZUBEN_ELSCHEMALI_DEG = dmsToDeg(-1, 9, 22, 58.0);

export const ZubenElschemali = {
    id: 'ref:zuben-elschemali',
    kind: 'reference',
    name: 'Zuben Elschemali',
    description: 'Zuben Elschemali (ICRF/J2000) — Beta Librae, the brighter traditional scale star of Libra with a strong place in classical star lore.',
    emoji: '★',
    meta: {
        color: '#b6ddff',
        distanceLy: 185.106,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ZUBEN_ELSCHEMALI_DEG,
                dec: DEC_ZUBEN_ELSCHEMALI_DEG
            }
        }
    }
} satisfies Obj;
