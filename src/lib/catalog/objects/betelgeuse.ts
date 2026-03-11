// src/lib/catalog/objects/betelgeuse.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Betelgeuse
const RA_BETELGEUSE_DEG = hmsToDeg(5, 55, 10.3053);
const DEC_BETELGEUSE_DEG = dmsToDeg(1, 7, 24, 25.426);

export const Betelgeuse = {
    id: 'ref:betelgeuse',
    kind: 'reference',
    name: 'Betelgeuse',
    description: 'Betelgeuse (ICRF/J2000) — a bright red supergiant in Orion that is famously variable in brightness.',
    emoji: '★',
    meta: {
        color: '#ffcc6f',
        distancePc: 152.6717,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BETELGEUSE_DEG,
                dec: DEC_BETELGEUSE_DEG
            }
        }
    }
} satisfies Obj;
