import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Alpheratz
const RA_ALPHERATZ_DEG = hmsToDeg(0, 8, 23.3);
const DEC_ALPHERATZ_DEG = dmsToDeg(1, 29, 5, 25.6);

export const Alpheratz = {
    id: 'ref:alpheratz',
    kind: 'reference',
    name: 'Alpheratz',
    description: 'Alpheratz (ICRF/J2000) — the bright corner star shared by Andromeda and Pegasus, often marking the Great Square.',
    emoji: '★',
    meta: {
        color: '#dce5ff',
        distanceLy: 97.012,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALPHERATZ_DEG,
                dec: DEC_ALPHERATZ_DEG
            }
        }
    }
} satisfies Obj;
