import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alsciaukat
const RA_ALSCIAUKAT_DEG = hmsToDeg(8, 22, 50.116800);
const DEC_ALSCIAUKAT_DEG = dmsToDeg(1, 43, 11, 17.271600);

export const Alsciaukat = {
    id: 'ref:alsciaukat',
    kind: 'star',
    name: 'Alsciaukat',
    description: 'Alsciaukat (ICRF/J2000) — bright star in Lynx.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc799',
        constellationId: 'ref:constellation:lyn',
        distancePc: 117.233300,
        apparentMagnitude: 4.25,
        properMotionRaMasYr: -25.620,
        properMotionDecMasYr: -99.440,
        radialVelocityKmS: 24.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALSCIAUKAT_DEG,
                dec: DEC_ALSCIAUKAT_DEG
            }
        }
    }
} satisfies StarObj;
