import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Lacaille 8760
const RA_LACAILLE8760_DEG = hmsToDeg(21, 17, 15.810000);
const DEC_LACAILLE8760_DEG = dmsToDeg(-1, 38, 52, 2.503200);

export const Lacaille8760 = {
    id: 'ref:lacaille-8760',
    kind: 'star',
    name: 'Lacaille 8760',
    description: 'Lacaille 8760 (ICRF/J2000) — bright star in Microscopium.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffcda4',
        constellationId: 'ref:constellation:mic',
        distancePc: 3.946200,
        apparentMagnitude: 6.69,
        properMotionRaMasYr: -3259.000,
        properMotionDecMasYr: -1146.990,
        radialVelocityKmS: 28.200,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LACAILLE8760_DEG,
                dec: DEC_LACAILLE8760_DEG
            }
        }
    }
} satisfies StarObj;
