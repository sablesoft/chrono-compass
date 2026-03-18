import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Deltoton
const RA_DELTOTON_DEG = hmsToDeg(2, 17, 3.087600);
const DEC_DELTOTON_DEG = dmsToDeg(1, 34, 13, 27.231600);

export const Deltoton = {
    id: 'ref:deltoton',
    kind: 'star',
    name: 'Deltoton',
    description: 'Deltoton (ICRF/J2000) — bright star in Triangulum.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff5eb',
        constellationId: 'ref:constellation:tri',
        distancePc: 10.784000,
        apparentMagnitude: 4.84,
        properMotionRaMasYr: 1151.610,
        properMotionDecMasYr: -246.320,
        radialVelocityKmS: -6.600,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DELTOTON_DEG,
                dec: DEC_DELTOTON_DEG
            }
        }
    }
} satisfies StarObj;
