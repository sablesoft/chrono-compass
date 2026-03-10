import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Adhara
const RA_ADHARA_DEG = hmsToDeg(6, 58, 37.5);
const DEC_ADHARA_DEG = dmsToDeg(-1, 28, 58, 20.0);

export const Adhara = {
    id: 'ref:adhara',
    kind: 'reference',
    name: { en: 'Adhara', ru: 'Адара' },
    description: {
        en: 'Adhara (ICRF/J2000) — Epsilon Canis Majoris, one of the brightest stars in the night sky and a major star of Canis Major.',
        ru: 'Адара (ICRF/J2000) — Эпсилон Большого Пса, одна из самых ярких звёзд ночного неба и важная звезда созвездия Большого Пса.'
    },
    emoji: '★',
    meta: {
        color: '#dce7ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ADHARA_DEG,
                dec: DEC_ADHARA_DEG
            }
        }
    }
} satisfies Obj;
