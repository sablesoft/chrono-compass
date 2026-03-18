import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Phact
const RA_PHACT_DEG = hmsToDeg(5, 39, 38.941200);
const DEC_PHACT_DEG = dmsToDeg(-1, 34, 4, 26.788800);

export const Phact = {
    id: 'ref:phact',
    kind: 'star',
    name: 'Phact',
    description: 'Phact (ICRF/J2000) — bright star in Columba.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#bfd4ff',
        constellationId: 'ref:constellation:col',
        distancePc: 80.128200,
        apparentMagnitude: 2.65,
        properMotionRaMasYr: -0.100,
        properMotionDecMasYr: -24.050,
        radialVelocityKmS: 35.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PHACT_DEG,
                dec: DEC_PHACT_DEG
            }
        }
    }
} satisfies StarObj;
