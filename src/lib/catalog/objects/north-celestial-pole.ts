import type { Obj } from '../types';

export const NorthCelestialPole = {
    id: 'ref:north-celestial-pole',
    kind: 'pole',
    name: 'North Celestial Pole',
    description: 'North Celestial Pole (ICRF/J2000) — the north rotation pole of the celestial sphere.',
    emoji: '⬆',
    meta: {
        color: '#bcd3ff',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: 0,
                dec: 90
            }
        }
    }
} satisfies Obj;
