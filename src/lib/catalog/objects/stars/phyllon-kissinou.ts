import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Phyllon Kissinou
const RA_PHYLLONKISSINOU_DEG = hmsToDeg(12, 34, 51.085200);
const DEC_PHYLLONKISSINOU_DEG = dmsToDeg(1, 22, 37, 45.332400);

export const PhyllonKissinou = {
    id: 'ref:phyllon-kissinou',
    kind: 'star',
    name: 'Phyllon Kissinou',
    description: 'Phyllon Kissinou (ICRF/J2000) — bright star in Coma Berenices.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cadaff',
        constellationId: 'ref:constellation:com',
        distancePc: 95.057000,
        apparentMagnitude: 4.80,
        properMotionRaMasYr: -57.420,
        properMotionDecMasYr: 28.530,
        radialVelocityKmS: -16.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PHYLLONKISSINOU_DEG,
                dec: DEC_PHYLLONKISSINOU_DEG
            }
        }
    }
} satisfies StarObj;
