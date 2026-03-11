import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Mirfak
const RA_MIRFAK_DEG = hmsToDeg(3, 24, 19.4);
const DEC_MIRFAK_DEG = dmsToDeg(1, 49, 51, 40.3);

export const Mirfak = {
    id: 'ref:mirfak',
    kind: 'reference',
    name: 'Mirfak',
    description: 'Mirfak (ICRF/J2000) — the brightest star in Perseus and the central beacon of the Alpha Persei association.',
    emoji: '★',
    meta: {
        color: '#fff0c8',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIRFAK_DEG,
                dec: DEC_MIRFAK_DEG
            }
        }
    }
} satisfies Obj;
