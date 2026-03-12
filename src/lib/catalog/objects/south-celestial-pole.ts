import type { Obj } from '../types';

export const SouthCelestialPole = {
    id: 'ref:south-celestial-pole',
    kind: 'pole',
    name: 'South Celestial Pole',
    description: 'South Celestial Pole (ICRF/J2000) — the south rotation pole of the celestial sphere.',
    emoji: '⬇',
    meta: {
        color: '#ffc9c9',
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: 0,
                dec: -90
            }
        }
    }
} satisfies Obj;
