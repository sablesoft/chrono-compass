import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tureis
const RA_TUREIS_DEG = hmsToDeg(8, 7, 32.653200);
const DEC_TUREIS_DEG = dmsToDeg(-1, 24, 18, 15.566400);

export const Tureis = {
    id: 'ref:tureis',
    kind: 'star',
    name: 'Tureis',
    description: 'Tureis (ICRF/J2000) — bright star in Puppis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fffffc',
        constellationId: 'ref:constellation:pup',
        distancePc: 19.481800,
        apparentMagnitude: 2.83,
        properMotionRaMasYr: -83.290,
        properMotionDecMasYr: 46.380,
        radialVelocityKmS: 46.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TUREIS_DEG,
                dec: DEC_TUREIS_DEG
            }
        }
    }
} satisfies StarObj;
