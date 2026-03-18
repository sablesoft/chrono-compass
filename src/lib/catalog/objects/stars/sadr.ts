import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sadr
const RA_SADR_DEG = hmsToDeg(20, 22, 13.702800);
const DEC_SADR_DEG = dmsToDeg(1, 40, 15, 24.044400);

export const Sadr = {
    id: 'ref:sadr',
    kind: 'star',
    name: 'Sadr',
    description: 'Sadr (ICRF/J2000) — bright star in Cygnus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff1e4',
        constellationId: 'ref:constellation:cyg',
        distancePc: 561.797800,
        apparentMagnitude: 2.23,
        properMotionRaMasYr: 2.430,
        properMotionDecMasYr: -0.930,
        radialVelocityKmS: -8.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SADR_DEG,
                dec: DEC_SADR_DEG
            }
        }
    }
} satisfies StarObj;
