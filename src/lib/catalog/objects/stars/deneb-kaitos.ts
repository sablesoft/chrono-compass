import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Deneb Kaitos
const RA_DENEB_KAITOS_DEG = hmsToDeg(0, 43, 35.4);
const DEC_DENEB_KAITOS_DEG = dmsToDeg(-1, 17, 59, 12.0);

export const DenebKaitos = {
    id: 'ref:deneb-kaitos',
    kind: 'star',
    name: 'Diphda',
    description: 'Diphda (ICRF/J2000) — Beta Ceti, traditionally also known as Deneb Kaitos.',
    emoji: '✦',
    meta: {
        color: '#ffd0a6',
        constellationId: 'ref:constellation:cet',
        distancePc: 29.5334,
        apparentMagnitude: 2.04,
        properMotionRaMasYr: 232.79,
        properMotionDecMasYr: 32.71,
        radialVelocityKmS: 13.3,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DENEB_KAITOS_DEG,
                dec: DEC_DENEB_KAITOS_DEG
            }
        }
    }
} satisfies StarObj;
