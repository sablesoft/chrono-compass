import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Miram
const RA_MIRAM_DEG = hmsToDeg(2, 50, 41.802000);
const DEC_MIRAM_DEG = dmsToDeg(1, 55, 53, 43.785600);

export const Miram = {
    id: 'ref:miram',
    kind: 'star',
    name: 'Miram',
    description: 'Miram (ICRF/J2000) — bright star in Perseus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc18e',
        constellationId: 'ref:constellation:per',
        distancePc: 269.541800,
        apparentMagnitude: 3.77,
        properMotionRaMasYr: 16.640,
        properMotionDecMasYr: -13.760,
        radialVelocityKmS: -1.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MIRAM_DEG,
                dec: DEC_MIRAM_DEG
            }
        }
    }
} satisfies StarObj;
