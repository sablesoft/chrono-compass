// src/lib/catalog/objects/deneb.ts
import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Deneb
const RA_DENEB_DEG = hmsToDeg(20, 41, 25.915);
const DEC_DENEB_DEG = dmsToDeg(1, 45, 16, 49.22);

export const Deneb = {
    id: 'ref:deneb',
    kind: 'reference',
    name: 'Deneb',
    description: 'Deneb (ICRF/J2000) — a luminous blue supergiant in Cygnus and one of the vertices of the Summer Triangle.',
    emoji: '✦',
    meta: {
        color: '#cad7ff',
        distancePc: 432.9005,
        apparentMagnitude: 1.25,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DENEB_DEG,
                dec: DEC_DENEB_DEG
            }
        }
    }
} satisfies Obj;
