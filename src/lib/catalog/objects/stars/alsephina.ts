import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alsephina
const RA_ALSEPHINA_DEG = hmsToDeg(8, 44, 42.212400);
const DEC_ALSEPHINA_DEG = dmsToDeg(-1, 54, 42, 31.755600);

export const Alsephina = {
    id: 'ref:alsephina',
    kind: 'star',
    name: 'Alsephina',
    description: 'Alsephina (ICRF/J2000) — bright star in Vela.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ccdcff',
        constellationId: 'ref:constellation:vel',
        distancePc: 24.697500,
        apparentMagnitude: 1.93,
        properMotionRaMasYr: 28.780,
        properMotionDecMasYr: -104.140,
        radialVelocityKmS: 2.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALSEPHINA_DEG,
                dec: DEC_ALSEPHINA_DEG
            }
        }
    }
} satisfies StarObj;
