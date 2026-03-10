import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Hamal
const RA_HAMAL_DEG = hmsToDeg(2, 7, 10.4);
const DEC_HAMAL_DEG = dmsToDeg(1, 23, 27, 44.7);

export const Hamal = {
    id: 'ref:hamal',
    kind: 'reference',
    name: { en: 'Hamal', ru: 'Хамаль' },
    description: {
        en: 'Hamal (ICRF/J2000) — the brightest star in Aries and a traditional marker of the Ram.',
        ru: 'Хамаль (ICRF/J2000) — самая яркая звезда Овна и традиционный маркер созвездия Барана.'
    },
    emoji: '★',
    meta: {
        color: '#ffcb8a',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HAMAL_DEG,
                dec: DEC_HAMAL_DEG
            }
        }
    }
} satisfies Obj;
