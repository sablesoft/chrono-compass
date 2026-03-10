import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Mintaka
const RA_MINTAKA_DEG = hmsToDeg(5, 32, 0.4);
const DEC_MINTAKA_DEG = dmsToDeg(-1, 0, 17, 56.0);

export const Mintaka = {
    id: 'ref:mintaka',
    kind: 'reference',
    name: { en: 'Mintaka', ru: 'Минтака' },
    description: {
        en: 'Mintaka (ICRF/J2000) — the western belt star of Orion, lying very close to the celestial equator.',
        ru: 'Минтака (ICRF/J2000) — западная звезда Пояса Ориона, лежащая очень близко к небесному экватору.'
    },
    emoji: '★',
    meta: {
        color: '#dfe8ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MINTAKA_DEG,
                dec: DEC_MINTAKA_DEG
            }
        }
    }
} satisfies Obj;
