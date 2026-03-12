import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Castor
const RA_CASTOR_DEG = hmsToDeg(7, 34, 36.0);
const DEC_CASTOR_DEG = dmsToDeg(1, 31, 53, 18.0);

export const Castor = {
    id: 'ref:castor',
    kind: 'reference',
    name: 'Castor',
    description: 'Castor (ICRF/J2000) — the second bright twin of Gemini and a famous naked-eye multiple-star system.',
    emoji: '✦',
    meta: {
        color: '#e8ebff',
        distancePc: 15.5959,
        apparentMagnitude: 1.58,
        properMotionRaMasYr: -206.33,
        properMotionDecMasYr: -148.18,
        radialVelocityKmS: 6,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CASTOR_DEG,
                dec: DEC_CASTOR_DEG
            }
        }
    }
} satisfies Obj;
