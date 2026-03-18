import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Elkurud
const RA_ELKURUD_DEG = hmsToDeg(6, 7, 31.630800);
const DEC_ELKURUD_DEG = dmsToDeg(-1, 37, 15, 10.512000);

export const Elkurud = {
    id: 'ref:elkurud',
    kind: 'star',
    name: 'Elkurud',
    description: 'Elkurud (ICRF/J2000) — bright star in Columba.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c1d5ff',
        constellationId: 'ref:constellation:col',
        distancePc: 221.238900,
        apparentMagnitude: 5.00,
        properMotionRaMasYr: 0.900,
        properMotionDecMasYr: 0.300,
        radialVelocityKmS: 45.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ELKURUD_DEG,
                dec: DEC_ELKURUD_DEG
            }
        }
    }
} satisfies StarObj;
