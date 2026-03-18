import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Porrima
const RA_PORRIMA_DEG = hmsToDeg(12, 41, 39.642000);
const DEC_PORRIMA_DEG = dmsToDeg(-1, 1, 26, 57.750000);

export const Porrima = {
    id: 'ref:porrima',
    kind: 'star',
    name: 'Porrima',
    description: 'Porrima (ICRF/J2000) — bright star in Virgo.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#f1f1ff',
        constellationId: 'ref:constellation:vir',
        distancePc: 11.685000,
        apparentMagnitude: 2.74,
        properMotionRaMasYr: -616.660,
        properMotionDecMasYr: 60.660,
        radialVelocityKmS: -19.900,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PORRIMA_DEG,
                dec: DEC_PORRIMA_DEG
            }
        }
    }
} satisfies StarObj;
