import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Achernar
const RA_ACHERNAR_DEG = hmsToDeg(1, 37, 42.8);
const DEC_ACHERNAR_DEG = dmsToDeg(-1, 57, 14, 12.0);

export const Achernar = {
    id: 'ref:achernar',
    kind: 'reference',
    name: { en: 'Achernar', ru: 'Ахернар' },
    description: {
        en: 'Achernar (ICRF/J2000) — the bright end star of Eridanus and one of the most luminous southern navigational stars.',
        ru: 'Ахернар (ICRF/J2000) — яркая конечная звезда Эридана и одна из самых заметных южных навигационных звёзд.'
    },
    emoji: '★',
    meta: {
        color: '#cfe0ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACHERNAR_DEG,
                dec: DEC_ACHERNAR_DEG
            }
        }
    }
} satisfies Obj;
