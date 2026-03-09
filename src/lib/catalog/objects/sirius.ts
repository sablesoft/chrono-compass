// src/lib/catalog/objects/sirius.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Sirius
const RA_SIRIUS_DEG = hmsToDeg(6, 45, 8.917);
const DEC_SIRIUS_DEG = dmsToDeg(-1, 16, 42, 58.11);

export const Sirius = {
    id: 'ref:sirius',
    kind: 'reference',
    name: { en: 'Sirius', ru: 'Сириус' },
    description: {
        en: 'Sirius (ICRF/J2000) — the brightest star in the night sky and the “Dog Star” of Canis Major.',
        ru: 'Сириус (ICRF/J2000) — самая яркая звезда ночного неба, «Пса» созвездия Большого Пса.'
    },
    emoji: '★',
    meta: {
        color: '#cad7ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SIRIUS_DEG,
                dec: DEC_SIRIUS_DEG
            }
        }
    }
} satisfies Obj;
