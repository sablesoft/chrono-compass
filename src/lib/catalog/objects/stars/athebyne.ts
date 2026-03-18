import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Athebyne
const RA_ATHEBYNE_DEG = hmsToDeg(16, 23, 59.496000);
const DEC_ATHEBYNE_DEG = dmsToDeg(1, 61, 30, 51.166800);

export const Athebyne = {
    id: 'ref:athebyne',
    kind: 'star',
    name: 'Athebyne',
    description: 'Athebyne (ICRF/J2000) — bright star in Draco.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe3cd',
        constellationId: 'ref:constellation:dra',
        distancePc: 28.232600,
        apparentMagnitude: 2.73,
        properMotionRaMasYr: -16.980,
        properMotionDecMasYr: 56.680,
        radialVelocityKmS: -13.700,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ATHEBYNE_DEG,
                dec: DEC_ATHEBYNE_DEG
            }
        }
    }
} satisfies StarObj;
