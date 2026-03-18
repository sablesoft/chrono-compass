import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kitalpha
const RA_KITALPHA_DEG = hmsToDeg(21, 15, 49.431600);
const DEC_KITALPHA_DEG = dmsToDeg(1, 5, 14, 52.242000);

export const Kitalpha = {
    id: 'ref:kitalpha',
    kind: 'star',
    name: 'Kitalpha',
    description: 'Kitalpha (ICRF/J2000) — bright star in Equuleus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff9f2',
        constellationId: 'ref:constellation:equ',
        distancePc: 58.343100,
        apparentMagnitude: 3.92,
        properMotionRaMasYr: 59.630,
        properMotionDecMasYr: -94.330,
        radialVelocityKmS: -16.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KITALPHA_DEG,
                dec: DEC_KITALPHA_DEG
            }
        }
    }
} satisfies StarObj;
