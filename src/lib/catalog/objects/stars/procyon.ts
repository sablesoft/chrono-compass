import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Procyon
const RA_PROCYON_DEG = hmsToDeg(7, 39, 18.118800);
const DEC_PROCYON_DEG = dmsToDeg(1, 5, 13, 29.974800);

export const Procyon = {
    id: 'ref:procyon',
    kind: 'star',
    name: 'Procyon',
    description: 'Procyon (ICRF/J2000) — bright star in Canis Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fef8ff',
        constellationId: 'ref:constellation:cmi',
        distancePc: 3.514200,
        apparentMagnitude: 0.40,
        properMotionRaMasYr: -716.570,
        properMotionDecMasYr: -1034.580,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PROCYON_DEG,
                dec: DEC_PROCYON_DEG
            }
        }
    }
} satisfies StarObj;
