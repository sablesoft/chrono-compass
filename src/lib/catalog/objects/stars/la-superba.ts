import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for La Superba
const RA_LASUPERBA_DEG = hmsToDeg(12, 45, 7.826400);
const DEC_LASUPERBA_DEG = dmsToDeg(1, 45, 26, 24.921600);

export const LaSuperba = {
    id: 'ref:la-superba',
    kind: 'star',
    name: 'La Superba',
    description: 'La Superba (ICRF/J2000) — bright star in Canes Venatici.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ff9b3c',
        constellationId: 'ref:constellation:cvn',
        distancePc: 320.512800,
        apparentMagnitude: 5.42,
        properMotionRaMasYr: -2.200,
        properMotionDecMasYr: 13.050,
        radialVelocityKmS: 12.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_LASUPERBA_DEG,
                dec: DEC_LASUPERBA_DEG
            }
        }
    }
} satisfies StarObj;
