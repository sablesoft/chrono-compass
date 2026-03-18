import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Aljanah
const RA_ALJANAH_DEG = hmsToDeg(20, 46, 12.640800);
const DEC_ALJANAH_DEG = dmsToDeg(1, 33, 58, 12.921600);

export const Aljanah = {
    id: 'ref:aljanah',
    kind: 'star',
    name: 'Aljanah',
    description: 'Aljanah (ICRF/J2000) — bright star in Cygnus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffdec3',
        constellationId: 'ref:constellation:cyg',
        distancePc: 22.291600,
        apparentMagnitude: 2.48,
        properMotionRaMasYr: 356.160,
        properMotionDecMasYr: 330.280,
        radialVelocityKmS: -10.900,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALJANAH_DEG,
                dec: DEC_ALJANAH_DEG
            }
        }
    }
} satisfies StarObj;
