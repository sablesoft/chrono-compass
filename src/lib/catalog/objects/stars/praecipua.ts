import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Praecipua
const RA_PRAECIPUA_DEG = hmsToDeg(10, 53, 18.693600);
const DEC_PRAECIPUA_DEG = dmsToDeg(1, 34, 12, 53.535600);

export const Praecipua = {
    id: 'ref:praecipua',
    kind: 'star',
    name: 'Praecipua',
    description: 'Praecipua (ICRF/J2000) — bright star in Leo Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffddc1',
        constellationId: 'ref:constellation:lmi',
        distancePc: 29.086700,
        apparentMagnitude: 3.79,
        properMotionRaMasYr: 92.470,
        properMotionDecMasYr: -286.060,
        radialVelocityKmS: 16.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_PRAECIPUA_DEG,
                dec: DEC_PRAECIPUA_DEG
            }
        }
    }
} satisfies StarObj;
