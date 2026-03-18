import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Citalá
const RA_CITALA_DEG = hmsToDeg(7, 0, 18.036000);
const DEC_CITALA_DEG = dmsToDeg(-1, 5, 22, 1.783200);

export const Citala = {
    id: 'ref:citala',
    kind: 'star',
    name: 'Citalá',
    description: 'Citalá (ICRF/J2000) — bright star in Monoceros.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff7ef',
        constellationId: 'ref:constellation:mon',
        distancePc: 28.960300,
        apparentMagnitude: 6.29,
        properMotionRaMasYr: -115.760,
        properMotionDecMasYr: 80.350,
        radialVelocityKmS: 54.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CITALA_DEG,
                dec: DEC_CITALA_DEG
            }
        }
    }
} satisfies StarObj;
