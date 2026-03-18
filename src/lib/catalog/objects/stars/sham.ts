import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sham
const RA_SHAM_DEG = hmsToDeg(19, 40, 5.790000);
const DEC_SHAM_DEG = dmsToDeg(1, 18, 0, 50.004000);

export const Sham = {
    id: 'ref:sham',
    kind: 'star',
    name: 'Sham',
    description: 'Sham (ICRF/J2000) — bright star in Sagitta.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffebda',
        constellationId: 'ref:constellation:sge',
        distancePc: 130.378100,
        apparentMagnitude: 4.39,
        properMotionRaMasYr: 15.090,
        properMotionDecMasYr: -19.720,
        radialVelocityKmS: 2.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SHAM_DEG,
                dec: DEC_SHAM_DEG
            }
        }
    }
} satisfies StarObj;
