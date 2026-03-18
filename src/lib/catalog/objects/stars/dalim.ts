import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Dalim
const RA_DALIM_DEG = hmsToDeg(3, 12, 4.496400);
const DEC_DALIM_DEG = dmsToDeg(-1, 28, 59, 15.424800);

export const Dalim = {
    id: 'ref:dalim',
    kind: 'star',
    name: 'Dalim',
    description: 'Dalim (ICRF/J2000) — bright star in Fornax.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff9f2',
        constellationId: 'ref:constellation:for',
        distancePc: 14.236900,
        apparentMagnitude: 3.80,
        properMotionRaMasYr: 371.490,
        properMotionDecMasYr: 612.260,
        radialVelocityKmS: -20.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DALIM_DEG,
                dec: DEC_DALIM_DEG
            }
        }
    }
} satisfies StarObj;
