import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Lusitânia
const RA_LUSITANIA_DEG = hmsToDeg(6, 29, 13.189200);
const DEC_LUSITANIA_DEG = dmsToDeg(1, 10, 56, 2.007600);

export const Lusitania = {
    id: 'ref:lusitania',
    kind: 'star',
    name: 'Lusitânia',
    description: 'Lusitânia (ICRF/J2000) — bright star in Monoceros.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe7d3',
        constellationId: 'ref:constellation:mon',
        distancePc: 34.352500,
        apparentMagnitude: 8.10,
        properMotionRaMasYr: 206.140,
        properMotionDecMasYr: -62.690,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LUSITANIA_DEG,
                dec: DEC_LUSITANIA_DEG
            }
        }
    }
} satisfies StarObj;
