import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Illyrian
const RA_ILLYRIAN_DEG = hmsToDeg(9, 35, 45.182400);
const DEC_ILLYRIAN_DEG = dmsToDeg(1, 34, 46, 50.671200);

export const Illyrian = {
    id: 'ref:illyrian',
    kind: 'star',
    name: 'Illyrian',
    description: 'Illyrian (ICRF/J2000) — bright star in Leo Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe6d1',
        constellationId: 'ref:constellation:lmi',
        distancePc: 125.470500,
        apparentMagnitude: 7.62,
        properMotionRaMasYr: 15.050,
        properMotionDecMasYr: -34.950,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ILLYRIAN_DEG,
                dec: DEC_ILLYRIAN_DEG
            }
        }
    }
} satisfies StarObj;
