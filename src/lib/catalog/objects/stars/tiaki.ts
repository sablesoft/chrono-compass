import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tiaki
const RA_TIAKI_DEG = hmsToDeg(22, 42, 40.014000);
const DEC_TIAKI_DEG = dmsToDeg(-1, 46, 53, 4.477200);

export const Tiaki = {
    id: 'ref:tiaki',
    kind: 'star',
    name: 'Tiaki',
    description: 'Tiaki (ICRF/J2000) — bright star in Grus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc494',
        constellationId: 'ref:constellation:gru',
        distancePc: 54.259400,
        apparentMagnitude: 2.07,
        properMotionRaMasYr: 135.680,
        properMotionDecMasYr: -4.510,
        radialVelocityKmS: 2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TIAKI_DEG,
                dec: DEC_TIAKI_DEG
            }
        }
    }
} satisfies StarObj;
