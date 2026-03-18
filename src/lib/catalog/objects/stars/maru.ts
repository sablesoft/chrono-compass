import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Maru
const RA_MARU_DEG = hmsToDeg(8, 6, 50.169600);
const DEC_MARU_DEG = dmsToDeg(-1, 66, 17, 59.578800);

export const Maru = {
    id: 'ref:maru',
    kind: 'star',
    name: 'Maru',
    description: 'Maru (ICRF/J2000) — bright star in Volans.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cddcff',
        constellationId: 'ref:constellation:vol',
        distancePc: 23.255800,
        apparentMagnitude: 13.92,
        properMotionRaMasYr: 370.370,
        properMotionDecMasYr: -289.360,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MARU_DEG,
                dec: DEC_MARU_DEG
            }
        }
    }
} satisfies StarObj;
