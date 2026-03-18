import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Asellus Australis
const RA_ASELLUSAUSTRALIS_DEG = hmsToDeg(8, 44, 41.100000);
const DEC_ASELLUSAUSTRALIS_DEG = dmsToDeg(1, 18, 9, 15.512400);

export const AsellusAustralis = {
    id: 'ref:asellus-australis',
    kind: 'star',
    name: 'Asellus Australis',
    description: 'Asellus Australis (ICRF/J2000) — bright star in Cancer.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdbbd',
        constellationId: 'ref:constellation:cnc',
        distancePc: 40.032000,
        apparentMagnitude: 3.94,
        properMotionRaMasYr: -17.100,
        properMotionDecMasYr: -228.460,
        radialVelocityKmS: 17.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ASELLUSAUSTRALIS_DEG,
                dec: DEC_ASELLUSAUSTRALIS_DEG
            }
        }
    }
} satisfies StarObj;
