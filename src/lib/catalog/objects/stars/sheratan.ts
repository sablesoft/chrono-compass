import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sheratan
const RA_SHERATAN_DEG = hmsToDeg(1, 54, 38.404800);
const DEC_SHERATAN_DEG = dmsToDeg(1, 20, 48, 28.926000);

export const Sheratan = {
    id: 'ref:sheratan',
    kind: 'star',
    name: 'Sheratan',
    description: 'Sheratan (ICRF/J2000) — bright star in Aries.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d7e2ff',
        constellationId: 'ref:constellation:ari',
        distancePc: 17.985600,
        apparentMagnitude: 2.64,
        properMotionRaMasYr: 96.320,
        properMotionDecMasYr: -108.800,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SHERATAN_DEG,
                dec: DEC_SHERATAN_DEG
            }
        }
    }
} satisfies StarObj;
