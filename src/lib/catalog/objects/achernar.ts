import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Achernar
const RA_ACHERNAR_DEG = hmsToDeg(1, 37, 42.8);
const DEC_ACHERNAR_DEG = dmsToDeg(-1, 57, 14, 12.0);

export const Achernar = {
    id: 'ref:achernar',
    kind: 'reference',
    name: 'Achernar',
    description: 'Achernar (ICRF/J2000) — the bright end star of Eridanus and one of the most luminous southern navigational stars.',
    emoji: '✶',
    meta: {
        color: '#cfe0ff',
        distancePc: 42.7532,
        apparentMagnitude: 0.45,
        properMotionRaMasYr: 88.02,
        properMotionDecMasYr: -40.08,
        radialVelocityKmS: 16,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ACHERNAR_DEG,
                dec: DEC_ACHERNAR_DEG
            }
        }
    }
} satisfies Obj;
