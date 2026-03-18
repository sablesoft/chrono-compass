import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Unukalhai
const RA_UNUKALHAI_DEG = hmsToDeg(15, 44, 16.072800);
const DEC_UNUKALHAI_DEG = dmsToDeg(1, 6, 25, 32.257200);

export const Unukalhai = {
    id: 'ref:unukalhai',
    kind: 'star',
    name: 'Unukalhai',
    description: 'Unukalhai (ICRF/J2000) — bright star in Serpens Caput.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd7b6',
        constellationId: 'ref:constellation:ser1',
        distancePc: 22.675700,
        apparentMagnitude: 2.63,
        properMotionRaMasYr: 134.660,
        properMotionDecMasYr: 44.140,
        radialVelocityKmS: 2.700,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_UNUKALHAI_DEG,
                dec: DEC_UNUKALHAI_DEG
            }
        }
    }
} satisfies StarObj;
