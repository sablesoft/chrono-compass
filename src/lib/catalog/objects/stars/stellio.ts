import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Stellio
const RA_STELLIO_DEG = hmsToDeg(22, 31, 17.454000);
const DEC_STELLIO_DEG = dmsToDeg(1, 50, 16, 56.967600);

export const Stellio = {
    id: 'ref:stellio',
    kind: 'star',
    name: 'Stellio',
    description: 'Stellio (ICRF/J2000) — bright star in Lacerta.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cbdbff',
        constellationId: 'ref:constellation:lac',
        distancePc: 31.456400,
        apparentMagnitude: 3.76,
        properMotionRaMasYr: 137.220,
        properMotionDecMasYr: 17.150,
        radialVelocityKmS: -4.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_STELLIO_DEG,
                dec: DEC_STELLIO_DEG
            }
        }
    }
} satisfies StarObj;
