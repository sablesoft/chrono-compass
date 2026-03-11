import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Vega
const RA_VEGA_DEG = hmsToDeg(18, 36, 56.336);
const DEC_VEGA_DEG = dmsToDeg(1, 38, 47, 1.28);

export const Vega = {
    id: 'ref:vega',
    kind: 'reference',
    name: 'Vega',
    description: 'Vega (ICRF/J2000) — the brightest star in Lyra and a prominent vertex of the Summer Triangle.',
    emoji: '★',
    meta: {
        color: '#d8e4ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_VEGA_DEG,
                dec: DEC_VEGA_DEG
            }
        }
    }
} satisfies Obj;
