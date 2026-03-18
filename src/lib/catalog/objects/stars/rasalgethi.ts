import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rasalgethi
const RA_RASALGETHI_DEG = hmsToDeg(17, 14, 38.857200);
const DEC_RASALGETHI_DEG = dmsToDeg(1, 14, 23, 25.198800);

export const Rasalgethi = {
    id: 'ref:rasalgethi',
    kind: 'star',
    name: 'Rasalgethi',
    description: 'Rasalgethi (ICRF/J2000) — bright star in Hercules.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd7b7',
        constellationId: 'ref:constellation:her',
        distancePc: 110.253600,
        apparentMagnitude: 2.78,
        properMotionRaMasYr: -6.710,
        properMotionDecMasYr: 32.780,
        radialVelocityKmS: -33.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RASALGETHI_DEG,
                dec: DEC_RASALGETHI_DEG
            }
        }
    }
} satisfies StarObj;
