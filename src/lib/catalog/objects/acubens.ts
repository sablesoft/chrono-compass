import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Acubens
const RA_ACUBENS_DEG = hmsToDeg(8, 58, 29.2);
const DEC_ACUBENS_DEG = dmsToDeg(1, 11, 51, 28.0);

export const Acubens = {
    id: 'ref:acubens',
    kind: 'reference',
    name: 'Acubens',
    description: 'Acubens (ICRF/J2000) — Alpha Cancri, a traditional star of Cancer associated with the Crab’s southern claw in classical star lore.',
    emoji: '★',
    meta: {
        color: '#d9e6ff',
        distancePc: 57.7368,
        apparentMagnitude: 4.26,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACUBENS_DEG,
                dec: DEC_ACUBENS_DEG
            }
        }
    }
} satisfies Obj;
