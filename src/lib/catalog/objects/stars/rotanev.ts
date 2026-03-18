import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rotanev
const RA_ROTANEV_DEG = hmsToDeg(20, 37, 32.937600);
const DEC_ROTANEV_DEG = dmsToDeg(1, 14, 35, 42.313200);

export const Rotanev = {
    id: 'ref:rotanev',
    kind: 'star',
    name: 'Rotanev',
    description: 'Rotanev (ICRF/J2000) — bright star in Delphinus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fcf7ff',
        constellationId: 'ref:constellation:del',
        distancePc: 30.931000,
        apparentMagnitude: 3.64,
        properMotionRaMasYr: 118.280,
        properMotionDecMasYr: -47.650,
        radialVelocityKmS: -23.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ROTANEV_DEG,
                dec: DEC_ROTANEV_DEG
            }
        }
    }
} satisfies StarObj;
