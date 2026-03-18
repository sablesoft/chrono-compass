import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Cocibolca
const RA_COCIBOLCA_DEG = hmsToDeg(0, 44, 26.628000);
const DEC_COCIBOLCA_DEG = dmsToDeg(-1, 26, 30, 56.448000);

export const Cocibolca = {
    id: 'ref:cocibolca',
    kind: 'star',
    name: 'Cocibolca',
    description: 'Cocibolca (ICRF/J2000) — bright star in Sculptor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff2e5',
        constellationId: 'ref:constellation:scl',
        distancePc: 32.372900,
        apparentMagnitude: 7.78,
        properMotionRaMasYr: 313.520,
        properMotionDecMasYr: 150.000,
        radialVelocityKmS: 55.400,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_COCIBOLCA_DEG,
                dec: DEC_COCIBOLCA_DEG
            }
        }
    }
} satisfies StarObj;
