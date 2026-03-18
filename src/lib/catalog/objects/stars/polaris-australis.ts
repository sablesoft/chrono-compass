import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Polaris Australis
const RA_POLARISAUSTRALIS_DEG = hmsToDeg(21, 8, 46.028400);
const DEC_POLARISAUSTRALIS_DEG = dmsToDeg(-1, 88, 57, 23.396400);

export const PolarisAustralis = {
    id: 'ref:polaris-australis',
    kind: 'star',
    name: 'Polaris Australis',
    description: 'Polaris Australis (ICRF/J2000) — bright star in Octans.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#e4eaff',
        constellationId: 'ref:constellation:oct',
        distancePc: 86.132600,
        apparentMagnitude: 5.45,
        properMotionRaMasYr: 25.960,
        properMotionDecMasYr: 5.020,
        radialVelocityKmS: 12.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POLARISAUSTRALIS_DEG,
                dec: DEC_POLARISAUSTRALIS_DEG
            }
        }
    }
} satisfies StarObj;
