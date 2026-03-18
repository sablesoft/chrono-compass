import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Babcock's star
const RA_BABCOCKSSTAR_DEG = hmsToDeg(22, 44, 7.504800);
const DEC_BABCOCKSSTAR_DEG = dmsToDeg(1, 55, 35, 21.213600);

export const BabcockSStar = {
    id: 'ref:babcock-s-star',
    kind: 'star',
    name: 'Babcock\'s star',
    description: 'Babcock\'s star (ICRF/J2000) — bright star in Lacerta.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cbdbff',
        constellationId: 'ref:constellation:lac',
        distancePc: 100000.000000,
        apparentMagnitude: 8.83,
        properMotionRaMasYr: 4.960,
        properMotionDecMasYr: -0.980,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BABCOCKSSTAR_DEG,
                dec: DEC_BABCOCKSSTAR_DEG
            }
        }
    }
} satisfies StarObj;
