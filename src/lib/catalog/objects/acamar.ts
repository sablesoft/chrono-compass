import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Acamar
const RA_ACAMAR_DEG = hmsToDeg(2, 58, 15.7);
const DEC_ACAMAR_DEG = dmsToDeg(-1, 40, 18, 17.0);

export const Acamar = {
    id: 'ref:acamar',
    kind: 'reference',
    name: 'Acamar',
    description: 'Acamar (ICRF/J2000) — Theta Eridani, a bright southern star in Eridanus historically linked with the end of the celestial river.',
    emoji: '★',
    meta: {
        color: '#d7e2ff',
        distancePc: 49.4316,
        apparentMagnitude: 2.88,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACAMAR_DEG,
                dec: DEC_ACAMAR_DEG
            }
        }
    }
} satisfies Obj;
