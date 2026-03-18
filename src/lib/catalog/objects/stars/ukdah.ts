import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Ukdah
const RA_UKDAH_DEG = hmsToDeg(9, 39, 51.361200);
const DEC_UKDAH_DEG = dmsToDeg(-1, 1, 8, 34.116000);

export const Ukdah = {
    id: 'ref:ukdah',
    kind: 'star',
    name: 'Ukdah',
    description: 'Ukdah (ICRF/J2000) — bright star in Hydra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd0ab',
        constellationId: 'ref:constellation:hya',
        distancePc: 80.710300,
        apparentMagnitude: 3.90,
        properMotionRaMasYr: 47.810,
        properMotionDecMasYr: -62.920,
        radialVelocityKmS: 23.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_UKDAH_DEG,
                dec: DEC_UKDAH_DEG
            }
        }
    }
} satisfies StarObj;
