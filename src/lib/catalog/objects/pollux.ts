import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Pollux
const RA_POLLUX_DEG = hmsToDeg(7, 45, 18.95);
const DEC_POLLUX_DEG = dmsToDeg(1, 28, 1, 34.3);

export const Pollux = {
    id: 'ref:pollux',
    kind: 'reference',
    name: 'Pollux',
    description: 'Pollux (ICRF/J2000) — the brightest star in Gemini and one of the classical twin stars.',
    emoji: '✦',
    meta: {
        color: '#ffd79d',
        distancePc: 10.3585,
        apparentMagnitude: 1.16,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POLLUX_DEG,
                dec: DEC_POLLUX_DEG
            }
        }
    }
} satisfies Obj;
