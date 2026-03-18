import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Pherkad
const RA_PHERKAD_DEG = hmsToDeg(15, 20, 43.738800);
const DEC_PHERKAD_DEG = dmsToDeg(1, 71, 50, 2.457600);

export const Pherkad = {
    id: 'ref:pherkad',
    kind: 'star',
    name: 'Pherkad',
    description: 'Pherkad (ICRF/J2000) — bright star in Ursa Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cedcff',
        constellationId: 'ref:constellation:umi',
        distancePc: 149.253700,
        apparentMagnitude: 3.00,
        properMotionRaMasYr: -18.030,
        properMotionDecMasYr: 17.680,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PHERKAD_DEG,
                dec: DEC_PHERKAD_DEG
            }
        }
    }
} satisfies StarObj;
