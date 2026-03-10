import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Graffias
const RA_GRAFFIAS_DEG = hmsToDeg(16, 5, 26.2);
const DEC_GRAFFIAS_DEG = dmsToDeg(-1, 19, 48, 20.0);

export const Graffias = {
    id: 'ref:graffias',
    kind: 'reference',
    name: { en: 'Graffias', ru: 'Граффиас' },
    description: {
        en: 'Graffias (ICRF/J2000) — Beta Scorpii, the bright multiple star long associated with the Scorpion’s claws in traditional star lore.',
        ru: 'Граффиас (ICRF/J2000) — Бета Скорпиона, яркая кратная звезда, давно связанная в традиционной звёздной символике с клешнями Скорпиона.'
    },
    emoji: '★',
    meta: {
        color: '#d7e1ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GRAFFIAS_DEG,
                dec: DEC_GRAFFIAS_DEG
            }
        }
    }
} satisfies Obj;
