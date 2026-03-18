import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Elnath
const RA_ELNATH_DEG = hmsToDeg(5, 26, 17.512800);
const DEC_ELNATH_DEG = dmsToDeg(1, 28, 36, 26.820000);

export const Elnath = {
    id: 'ref:elnath',
    kind: 'star',
    name: 'Elnath',
    description: 'Elnath (ICRF/J2000) — bright star in Taurus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bfd3ff',
        constellationId: 'ref:constellation:tau',
        distancePc: 41.050900,
        apparentMagnitude: 1.65,
        properMotionRaMasYr: 23.280,
        properMotionDecMasYr: -174.220,
        radialVelocityKmS: 9.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ELNATH_DEG,
                dec: DEC_ELNATH_DEG
            }
        }
    }
} satisfies StarObj;
