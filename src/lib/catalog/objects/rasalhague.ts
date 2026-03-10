import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Rasalhague
const RA_RASALHAGUE_DEG = hmsToDeg(17, 34, 56.1);
const DEC_RASALHAGUE_DEG = dmsToDeg(1, 12, 33, 36.0);

export const Rasalhague = {
    id: 'ref:rasalhague',
    kind: 'reference',
    name: { en: 'Rasalhague', ru: 'Расальхаге' },
    description: {
        en: 'Rasalhague (ICRF/J2000) — Alpha Ophiuchi, the bright head star of the Serpent Bearer and a prominent marker of Ophiuchus.',
        ru: 'Расальхаге (ICRF/J2000) — Альфа Змееносца, яркая звезда головы Змееносца и заметный маркер этого созвездия.'
    },
    emoji: '★',
    meta: {
        color: '#edf2ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RASALHAGUE_DEG,
                dec: DEC_RASALHAGUE_DEG
            }
        }
    }
} satisfies Obj;
