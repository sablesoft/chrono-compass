import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sheliak
const RA_SHELIAK_DEG = hmsToDeg(18, 50, 4.794000);
const DEC_SHELIAK_DEG = dmsToDeg(1, 33, 21, 45.601200);

export const Sheliak = {
    id: 'ref:sheliak',
    kind: 'star',
    name: 'Sheliak',
    description: 'Sheliak (ICRF/J2000) — bright star in Lyra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c9daff',
        constellationId: 'ref:constellation:lyr',
        distancePc: 294.985300,
        apparentMagnitude: 3.52,
        properMotionRaMasYr: 1.100,
        properMotionDecMasYr: -4.460,
        radialVelocityKmS: -19.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SHELIAK_DEG,
                dec: DEC_SHELIAK_DEG
            }
        }
    }
} satisfies StarObj;
