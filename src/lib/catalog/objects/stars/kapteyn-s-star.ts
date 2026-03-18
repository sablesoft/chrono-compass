import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kapteyn's Star
const RA_KAPTEYNSSTAR_DEG = hmsToDeg(5, 11, 39.008400);
const DEC_KAPTEYNSSTAR_DEG = dmsToDeg(-1, 45, 1, 6.301200);

export const KapteynSStar = {
    id: 'ref:kapteyn-s-star',
    kind: 'star',
    name: 'Kapteyn\'s Star',
    description: 'Kapteyn\'s Star (ICRF/J2000) — bright star in Pictor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc799',
        constellationId: 'ref:constellation:pic',
        distancePc: 3.911400,
        apparentMagnitude: 8.86,
        properMotionRaMasYr: 6506.050,
        properMotionDecMasYr: -5731.390,
        radialVelocityKmS: 245.500,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KAPTEYNSSTAR_DEG,
                dec: DEC_KAPTEYNSSTAR_DEG
            }
        }
    }
} satisfies StarObj;
