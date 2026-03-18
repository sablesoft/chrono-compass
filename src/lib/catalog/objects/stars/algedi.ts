import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Algedi
const RA_ALGEDI_DEG = hmsToDeg(20, 18, 3.254400);
const DEC_ALGEDI_DEG = dmsToDeg(-1, 12, 32, 41.467200);

export const Algedi = {
    id: 'ref:algedi',
    kind: 'star',
    name: 'Algedi',
    description: 'Algedi (ICRF/J2000) — bright star in Capricornus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe5cf',
        constellationId: 'ref:constellation:cap',
        distancePc: 32.446500,
        apparentMagnitude: 3.58,
        properMotionRaMasYr: 61.780,
        properMotionDecMasYr: 2.850,
        radialVelocityKmS: 0.700,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALGEDI_DEG,
                dec: DEC_ALGEDI_DEG
            }
        }
    }
} satisfies StarObj;
