import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Pipit
const RA_PIPIT_DEG = hmsToDeg(6, 37, 45.670800);
const DEC_PIPIT_DEG = dmsToDeg(-1, 43, 11, 45.362400);

export const Pipit = {
    id: 'ref:pipit',
    kind: 'star',
    name: 'Pipit',
    description: 'Pipit (ICRF/J2000) — bright star in Puppis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c1d5ff',
        constellationId: 'ref:constellation:pup',
        distancePc: 113.895200,
        apparentMagnitude: 3.17,
        properMotionRaMasYr: -0.430,
        properMotionDecMasYr: -3.990,
        radialVelocityKmS: 28.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PIPIT_DEG,
                dec: DEC_PIPIT_DEG
            }
        }
    }
} satisfies StarObj;
