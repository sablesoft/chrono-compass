import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Errai
const RA_ERRAI_DEG = hmsToDeg(23, 39, 20.952000);
const DEC_ERRAI_DEG = dmsToDeg(1, 77, 37, 56.193600);

export const Errai = {
    id: 'ref:errai',
    kind: 'star',
    name: 'Errai',
    description: 'Errai (ICRF/J2000) — bright star in Cepheus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffddc2',
        constellationId: 'ref:constellation:cep',
        distancePc: 14.102400,
        apparentMagnitude: 3.21,
        properMotionRaMasYr: -48.850,
        properMotionDecMasYr: 127.180,
        radialVelocityKmS: -43.100,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ERRAI_DEG,
                dec: DEC_ERRAI_DEG
            }
        }
    }
} satisfies StarObj;
