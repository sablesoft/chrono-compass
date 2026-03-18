import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Dabih
const RA_DABIH_DEG = hmsToDeg(20, 21, 0.673200);
const DEC_DABIH_DEG = dmsToDeg(-1, 14, 46, 52.921200);

export const Dabih = {
    id: 'ref:dabih',
    kind: 'star',
    name: 'Dabih',
    description: 'Dabih (ICRF/J2000) — bright star in Capricornus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffead8',
        constellationId: 'ref:constellation:cap',
        distancePc: 100.200400,
        apparentMagnitude: 3.05,
        properMotionRaMasYr: 48.420,
        properMotionDecMasYr: 14.000,
        radialVelocityKmS: -19.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DABIH_DEG,
                dec: DEC_DABIH_DEG
            }
        }
    }
} satisfies StarObj;
