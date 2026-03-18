import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Anser
const RA_ANSER_DEG = hmsToDeg(19, 28, 42.337200);
const DEC_ANSER_DEG = dmsToDeg(1, 24, 39, 53.658000);

export const Anser = {
    id: 'ref:anser',
    kind: 'star',
    name: 'Anser',
    description: 'Anser (ICRF/J2000) — bright star in Vulpecula.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc89c',
        constellationId: 'ref:constellation:vul',
        distancePc: 91.157700,
        apparentMagnitude: 4.44,
        properMotionRaMasYr: -126.450,
        properMotionDecMasYr: -106.990,
        radialVelocityKmS: -86.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ANSER_DEG,
                dec: DEC_ANSER_DEG
            }
        }
    }
} satisfies StarObj;
