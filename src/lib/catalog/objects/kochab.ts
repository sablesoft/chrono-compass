import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Kochab
const RA_KOCHAB_DEG = hmsToDeg(14, 50, 42.3);
const DEC_KOCHAB_DEG = dmsToDeg(1, 74, 9, 20.0);

export const Kochab = {
    id: 'ref:kochab',
    kind: 'reference',
    name: 'Kochab',
    description: 'Kochab (ICRF/J2000) — Beta Ursae Minoris, a bright northern star in the Little Dipper and a notable pre-Polaris pole star.',
    emoji: '★',
    meta: {
        color: '#efe6c8',
        distancePc: 40.1446,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KOCHAB_DEG,
                dec: DEC_KOCHAB_DEG
            }
        }
    }
} satisfies Obj;
