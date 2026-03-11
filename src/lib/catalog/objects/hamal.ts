import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Hamal
const RA_HAMAL_DEG = hmsToDeg(2, 7, 10.4);
const DEC_HAMAL_DEG = dmsToDeg(1, 23, 27, 44.7);

export const Hamal = {
    id: 'ref:hamal',
    kind: 'reference',
    name: 'Hamal',
    description: 'Hamal (ICRF/J2000) — the brightest star in Aries and a traditional marker of the Ram.',
    emoji: '★',
    meta: {
        color: '#ffcb8a',
        distancePc: 20.1775,
        apparentMagnitude: 2.01,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HAMAL_DEG,
                dec: DEC_HAMAL_DEG
            }
        }
    }
} satisfies Obj;
