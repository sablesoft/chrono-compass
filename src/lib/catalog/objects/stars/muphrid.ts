import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Muphrid
const RA_MUPHRID_DEG = hmsToDeg(13, 54, 41.079600);
const DEC_MUPHRID_DEG = dmsToDeg(1, 18, 23, 51.781200);

export const Muphrid = {
    id: 'ref:muphrid',
    kind: 'star',
    name: 'Muphrid',
    description: 'Muphrid (ICRF/J2000) — bright star in Bootes.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff7ee',
        constellationId: 'ref:constellation:boo',
        distancePc: 11.396000,
        apparentMagnitude: 2.68,
        properMotionRaMasYr: -60.950,
        properMotionDecMasYr: -358.100,
        radialVelocityKmS: 1.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MUPHRID_DEG,
                dec: DEC_MUPHRID_DEG
            }
        }
    }
} satisfies StarObj;
