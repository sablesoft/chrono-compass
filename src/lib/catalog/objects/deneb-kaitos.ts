import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Deneb Kaitos
const RA_DENEB_KAITOS_DEG = hmsToDeg(0, 43, 35.4);
const DEC_DENEB_KAITOS_DEG = dmsToDeg(-1, 17, 59, 12.0);

export const DenebKaitos = {
    id: 'ref:deneb-kaitos',
    kind: 'reference',
    name: 'Deneb Kaitos',
    description: 'Deneb Kaitos (ICRF/J2000) — the bright tail star of Cetus, also known as Diphda in many catalogs.',
    emoji: '★',
    meta: {
        color: '#ffd0a6',
        distancePc: 29.5334,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DENEB_KAITOS_DEG,
                dec: DEC_DENEB_KAITOS_DEG
            }
        }
    }
} satisfies Obj;
