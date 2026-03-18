import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Aldulfin
const RA_ALDULFIN_DEG = hmsToDeg(20, 33, 12.769200);
const DEC_ALDULFIN_DEG = dmsToDeg(1, 11, 18, 11.746800);

export const Aldulfin = {
    id: 'ref:aldulfin',
    kind: 'star',
    name: 'Aldulfin',
    description: 'Aldulfin (ICRF/J2000) — bright star in Delphinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bfd4ff',
        constellationId: 'ref:constellation:del',
        distancePc: 101.317100,
        apparentMagnitude: 4.03,
        properMotionRaMasYr: 10.750,
        properMotionDecMasYr: -28.540,
        radialVelocityKmS: -19.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALDULFIN_DEG,
                dec: DEC_ALDULFIN_DEG
            }
        }
    }
} satisfies StarObj;
