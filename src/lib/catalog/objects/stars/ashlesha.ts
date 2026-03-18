import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Ashlesha
const RA_ASHLESHA_DEG = hmsToDeg(8, 46, 46.513200);
const DEC_ASHLESHA_DEG = dmsToDeg(1, 6, 25, 7.712400);

export const Ashlesha = {
    id: 'ref:ashlesha',
    kind: 'star',
    name: 'Ashlesha',
    description: 'Ashlesha (ICRF/J2000) — bright star in Hydra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff0e3',
        constellationId: 'ref:constellation:hya',
        distancePc: 39.635400,
        apparentMagnitude: 3.38,
        properMotionRaMasYr: -231.040,
        properMotionDecMasYr: -40.170,
        radialVelocityKmS: 36.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ASHLESHA_DEG,
                dec: DEC_ASHLESHA_DEG
            }
        }
    }
} satisfies StarObj;
