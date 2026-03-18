import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Wazn
const RA_WAZN_DEG = hmsToDeg(5, 50, 57.584400);
const DEC_WAZN_DEG = dmsToDeg(-1, 35, 46, 5.912400);

export const Wazn = {
    id: 'ref:wazn',
    kind: 'star',
    name: 'Wazn',
    description: 'Wazn (ICRF/J2000) — bright star in Columba.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd8b8',
        constellationId: 'ref:constellation:col',
        distancePc: 26.730800,
        apparentMagnitude: 3.12,
        properMotionRaMasYr: 55.740,
        properMotionDecMasYr: 404.680,
        radialVelocityKmS: 89.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_WAZN_DEG,
                dec: DEC_WAZN_DEG
            }
        }
    }
} satisfies StarObj;
