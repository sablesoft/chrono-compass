import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Polis
const RA_POLIS_DEG = hmsToDeg(19, 21, 40.4);
const DEC_POLIS_DEG = dmsToDeg(-1, 21, 1, 11.0);

export const Polis = {
    id: 'ref:polis',
    kind: 'reference',
    name: 'Polis',
    description: 'Polis (ICRF/J2000) — Mu Sagittarii, a notable Sagittarius star near the Archer’s head and part of the broader galactic-center region sky lore.',
    emoji: '✦',
    meta: {
        color: '#ffe0ba',
        distancePc: 79.6177,
        apparentMagnitude: 3.84,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POLIS_DEG,
                dec: DEC_POLIS_DEG
            }
        }
    }
} satisfies Obj;
