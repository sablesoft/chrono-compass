import { dmsToDeg, hmsToDeg, type Obj } from '../../types';

// J2000 coordinates for Adhara
const RA_ADHARA_DEG = hmsToDeg(6, 58, 37.5);
const DEC_ADHARA_DEG = dmsToDeg(-1, 28, 58, 20.0);

export const Adhara = {
    id: 'ref:adhara',
    kind: 'reference',
    name: 'Adhara',
    description: 'Adhara (ICRF/J2000) — Epsilon Canis Majoris, one of the brightest stars in the night sky and a major star of Canis Major.',
    emoji: '✦',
    meta: {
        color: '#dce7ff',
        distancePc: 124.2237,
        apparentMagnitude: 1.5,
        properMotionRaMasYr: 2.63,
        properMotionDecMasYr: 2.29,
        radialVelocityKmS: 27,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ADHARA_DEG,
                dec: DEC_ADHARA_DEG
            }
        }
    }
} satisfies Obj;
