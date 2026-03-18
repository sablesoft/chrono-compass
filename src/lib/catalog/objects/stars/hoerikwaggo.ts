import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Hoerikwaggo
const RA_HOERIKWAGGO_DEG = hmsToDeg(6, 10, 14.275200);
const DEC_HOERIKWAGGO_DEG = dmsToDeg(-1, 74, 45, 10.962000);

export const Hoerikwaggo = {
    id: 'ref:hoerikwaggo',
    kind: 'star',
    name: 'Hoerikwaggo',
    description: 'Hoerikwaggo (ICRF/J2000) — bright star in Mensa.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffeee0',
        constellationId: 'ref:constellation:men',
        distancePc: 10.197800,
        apparentMagnitude: 5.08,
        properMotionRaMasYr: 121.840,
        properMotionDecMasYr: -212.820,
        radialVelocityKmS: 34.900,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_HOERIKWAGGO_DEG,
                dec: DEC_HOERIKWAGGO_DEG
            }
        }
    }
} satisfies StarObj;
