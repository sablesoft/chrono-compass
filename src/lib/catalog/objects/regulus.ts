import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Regulus
const RA_REGULUS_DEG = hmsToDeg(10, 8, 22.3);
const DEC_REGULUS_DEG = dmsToDeg(1, 11, 58, 2.0);

export const Regulus = {
    id: 'ref:regulus',
    kind: 'reference',
    name: { en: 'Regulus', ru: 'Регул' },
    description: {
        en: 'Regulus (ICRF/J2000) — the heart of Leo and one of the most famous royal stars in historical traditions.',
        ru: 'Регул (ICRF/J2000) — сердце Льва и одна из самых известных царских звёзд в исторических традициях.'
    },
    emoji: '★',
    meta: {
        color: '#d6deff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_REGULUS_DEG,
                dec: DEC_REGULUS_DEG
            }
        }
    }
} satisfies Obj;
