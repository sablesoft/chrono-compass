import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Sargas
const RA_SARGAS_DEG = hmsToDeg(17, 37, 19.1);
const DEC_SARGAS_DEG = dmsToDeg(-1, 42, 59, 52.0);

export const Sargas = {
    id: 'ref:sargas',
    kind: 'reference',
    name: 'Sargas',
    description: 'Sargas (ICRF/J2000) — Theta Scorpii, a bright southern star in the Scorpion often used as a marker of its curving tail region.',
    emoji: '✦',
    meta: {
        color: '#ffe1b8',
        distancePc: 92.0811,
        apparentMagnitude: 1.86,
        properMotionRaMasYr: 6.06,
        properMotionDecMasYr: -0.95,
        radialVelocityKmS: 1,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SARGAS_DEG,
                dec: DEC_SARGAS_DEG
            }
        }
    }
} satisfies Obj;
