import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Lacaille 9352
const RA_LACAILLE9352_DEG = hmsToDeg(23, 5, 51.111600);
const DEC_LACAILLE9352_DEG = dmsToDeg(-1, 35, 51, 11.062800);

export const Lacaille9352 = {
    id: 'ref:lacaille-9352',
    kind: 'star',
    name: 'Lacaille 9352',
    description: 'Lacaille 9352 (ICRF/J2000) — bright star in Pisces Austrinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc99d',
        constellationId: 'ref:constellation:psa',
        distancePc: 3.275900,
        apparentMagnitude: 7.35,
        properMotionRaMasYr: 6767.260,
        properMotionDecMasYr: 1326.660,
        radialVelocityKmS: 9.500,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LACAILLE9352_DEG,
                dec: DEC_LACAILLE9352_DEG
            }
        }
    }
} satisfies StarObj;
