import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Aldebaran
const RA_ALDEBARAN_DEG = hmsToDeg(4, 35, 55.24);
const DEC_ALDEBARAN_DEG = dmsToDeg(1, 16, 30, 33.5);

export const Aldebaran = {
    id: 'ref:aldebaran',
    kind: 'reference',
    name: 'Aldebaran',
    description: 'Aldebaran (ICRF/J2000) — the orange eye of Taurus and one of the best-known bright stars of the zodiac.',
    emoji: '✶',
    meta: {
        color: '#ffb46d',
        distancePc: 20.4332,
        apparentMagnitude: 0.87,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALDEBARAN_DEG,
                dec: DEC_ALDEBARAN_DEG
            }
        }
    }
} satisfies Obj;
