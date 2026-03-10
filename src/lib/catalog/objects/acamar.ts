import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Acamar
const RA_ACAMAR_DEG = hmsToDeg(2, 58, 15.7);
const DEC_ACAMAR_DEG = dmsToDeg(-1, 40, 18, 17.0);

export const Acamar = {
    id: 'ref:acamar',
    kind: 'reference',
    name: { en: 'Acamar', ru: 'Акамар' },
    description: {
        en: 'Acamar (ICRF/J2000) — Theta Eridani, a bright southern star in Eridanus historically linked with the end of the celestial river.',
        ru: 'Акамар (ICRF/J2000) — Тета Эридана, яркая южная звезда в созвездии Эридана, исторически связанная с окончанием небесной реки.'
    },
    emoji: '★',
    meta: {
        color: '#d7e2ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACAMAR_DEG,
                dec: DEC_ACAMAR_DEG
            }
        }
    }
} satisfies Obj;
