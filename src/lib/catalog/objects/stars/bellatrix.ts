import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Bellatrix
const RA_BELLATRIX_DEG = hmsToDeg(5, 25, 7.863600);
const DEC_BELLATRIX_DEG = dmsToDeg(1, 6, 20, 58.927200);

export const Bellatrix = {
    id: 'ref:bellatrix',
    kind: 'star',
    name: 'Bellatrix',
    description: 'Bellatrix (ICRF/J2000) — bright star in Orion.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#b7cfff',
        constellationId: 'ref:constellation:ori',
        distancePc: 77.399400,
        apparentMagnitude: 1.64,
        properMotionRaMasYr: -8.750,
        properMotionDecMasYr: -13.280,
        radialVelocityKmS: 18.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BELLATRIX_DEG,
                dec: DEC_BELLATRIX_DEG
            }
        }
    }
} satisfies StarObj;
