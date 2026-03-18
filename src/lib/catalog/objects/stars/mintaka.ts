import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Mintaka
const RA_MINTAKA_DEG = hmsToDeg(5, 32, 0.4);
const DEC_MINTAKA_DEG = dmsToDeg(-1, 0, 17, 56.0);

export const Mintaka = {
    id: 'ref:mintaka',
    kind: 'star',
    name: 'Mintaka',
    description: 'Mintaka (ICRF/J2000) — the western belt star of Orion, lying very close to the celestial equator.',
    emoji: '✦',
    meta: {
        color: '#dfe8ff',
        constellationId: 'ref:constellation:ori',
        distancePc: 212.3144,
        apparentMagnitude: 2.25,
        properMotionRaMasYr: 1.67,
        properMotionDecMasYr: 0.56,
        radialVelocityKmS: 16,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_MINTAKA_DEG,
                dec: DEC_MINTAKA_DEG
            }
        }
    }
} satisfies StarObj;
