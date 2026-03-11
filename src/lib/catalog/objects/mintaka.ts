import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Mintaka
const RA_MINTAKA_DEG = hmsToDeg(5, 32, 0.4);
const DEC_MINTAKA_DEG = dmsToDeg(-1, 0, 17, 56.0);

export const Mintaka = {
    id: 'ref:mintaka',
    kind: 'reference',
    name: 'Mintaka',
    description: 'Mintaka (ICRF/J2000) — the western belt star of Orion, lying very close to the celestial equator.',
    emoji: '★',
    meta: {
        color: '#dfe8ff',
        distanceLy: 692.476,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MINTAKA_DEG,
                dec: DEC_MINTAKA_DEG
            }
        }
    }
} satisfies Obj;
