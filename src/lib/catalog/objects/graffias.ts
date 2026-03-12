import { dmsToDeg, hmsToDeg, type Obj } from '../types';

// J2000 coordinates for Graffias
const RA_GRAFFIAS_DEG = hmsToDeg(16, 5, 26.2);
const DEC_GRAFFIAS_DEG = dmsToDeg(-1, 19, 48, 20.0);

export const Graffias = {
    id: 'ref:graffias',
    kind: 'reference',
    name: 'Graffias',
    description: 'Graffias (ICRF/J2000) — Beta Scorpii, the bright multiple star long associated with the Scorpion’s claws in traditional star lore.',
    emoji: '✦',
    meta: {
        color: '#d7e1ff',
        distancePc: 123.9155,
        apparentMagnitude: 4.84,
        properMotionRaMasYr: -6.75,
        properMotionDecMasYr: -24.89,
        radialVelocityKmS: -1,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GRAFFIAS_DEG,
                dec: DEC_GRAFFIAS_DEG
            }
        }
    }
} satisfies Obj;
