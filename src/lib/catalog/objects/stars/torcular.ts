import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Torcular
const RA_TORCULAR_DEG = hmsToDeg(1, 45, 23.630400);
const DEC_TORCULAR_DEG = dmsToDeg(1, 9, 9, 27.849600);

export const Torcular = {
    id: 'ref:torcular',
    kind: 'star',
    name: 'Torcular',
    description: 'Torcular (ICRF/J2000) — bright star in Pisces.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe2ca',
        constellationId: 'ref:constellation:psc',
        distancePc: 85.689800,
        apparentMagnitude: 4.26,
        properMotionRaMasYr: 70.820,
        properMotionDecMasYr: 38.990,
        radialVelocityKmS: 14.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TORCULAR_DEG,
                dec: DEC_TORCULAR_DEG
            }
        }
    }
} satisfies StarObj;
