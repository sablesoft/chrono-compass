import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Uridim
const RA_URIDIM_DEG = hmsToDeg(14, 41, 55.762800);
const DEC_URIDIM_DEG = dmsToDeg(-1, 47, 23, 17.520000);

export const Uridim = {
    id: 'ref:uridim',
    kind: 'star',
    name: 'Uridim',
    description: 'Uridim (ICRF/J2000) — bright star in Lupus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bdd2ff',
        constellationId: 'ref:constellation:lup',
        distancePc: 142.450100,
        apparentMagnitude: 2.30,
        properMotionRaMasYr: -21.150,
        properMotionDecMasYr: -24.220,
        radialVelocityKmS: 5.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_URIDIM_DEG,
                dec: DEC_URIDIM_DEG
            }
        }
    }
} satisfies StarObj;
