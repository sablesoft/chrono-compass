import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Shaula
const RA_SHAULA_DEG = hmsToDeg(17, 33, 36.5);
const DEC_SHAULA_DEG = dmsToDeg(-1, 37, 6, 13.0);

export const Shaula = {
    id: 'ref:shaula',
    kind: 'star',
    name: 'Shaula',
    description: 'Shaula (ICRF/J2000) — one of the bright tail stars of Scorpius and a striking southern blue star.',
    emoji: '✦',
    meta: {
        color: '#cfe0ff',
        constellationId: 'ref:constellation:sco',
        distancePc: 175.1312,
        apparentMagnitude: 1.62,
        properMotionRaMasYr: -8.9,
        properMotionDecMasYr: -29.95,
        radialVelocityKmS: -3,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SHAULA_DEG,
                dec: DEC_SHAULA_DEG
            }
        }
    }
} satisfies StarObj;
