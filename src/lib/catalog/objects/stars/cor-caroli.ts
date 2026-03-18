import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Cor Caroli
const RA_CORCAROLI_DEG = hmsToDeg(12, 56, 1.705200);
const DEC_CORCAROLI_DEG = dmsToDeg(1, 38, 19, 6.168000);

export const CorCaroli = {
    id: 'ref:cor-caroli',
    kind: 'star',
    name: 'Cor Caroli',
    description: 'Cor Caroli (ICRF/J2000) — bright star in Canes Venatici.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c0d4ff',
        constellationId: 'ref:constellation:cvn',
        distancePc: 35.198900,
        apparentMagnitude: 2.89,
        properMotionRaMasYr: -233.430,
        properMotionDecMasYr: 54.980,
        radialVelocityKmS: -3.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CORCAROLI_DEG,
                dec: DEC_CORCAROLI_DEG
            }
        }
    }
} satisfies StarObj;
