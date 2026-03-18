import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Chara
const RA_CHARA_DEG = hmsToDeg(12, 33, 44.679600);
const DEC_CHARA_DEG = dmsToDeg(1, 41, 21, 26.928000);

export const Chara = {
    id: 'ref:chara',
    kind: 'star',
    name: 'Chara',
    description: 'Chara (ICRF/J2000) — bright star in Canes Venatici.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff6ed',
        constellationId: 'ref:constellation:cvn',
        distancePc: 8.439500,
        apparentMagnitude: 4.24,
        properMotionRaMasYr: -705.060,
        properMotionDecMasYr: 292.930,
        radialVelocityKmS: 6.600,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CHARA_DEG,
                dec: DEC_CHARA_DEG
            }
        }
    }
} satisfies StarObj;
