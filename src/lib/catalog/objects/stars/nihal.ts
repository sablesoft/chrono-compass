import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Nihal
const RA_NIHAL_DEG = hmsToDeg(5, 28, 14.721600);
const DEC_NIHAL_DEG = dmsToDeg(-1, 20, 45, 33.987600);

export const Nihal = {
    id: 'ref:nihal',
    kind: 'star',
    name: 'Nihal',
    description: 'Nihal (ICRF/J2000) — bright star in Lepus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe9d7',
        constellationId: 'ref:constellation:lep',
        distancePc: 49.164200,
        apparentMagnitude: 2.81,
        properMotionRaMasYr: -5.030,
        properMotionDecMasYr: -85.920,
        radialVelocityKmS: -14.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_NIHAL_DEG,
                dec: DEC_NIHAL_DEG
            }
        }
    }
} satisfies StarObj;
