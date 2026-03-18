import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Capella
const RA_CAPELLA_DEG = hmsToDeg(5, 16, 41.36);
const DEC_CAPELLA_DEG = dmsToDeg(1, 45, 59, 52.8);

export const Capella = {
    id: 'ref:capella',
    kind: 'star',
    name: 'Capella',
    description: 'Capella (ICRF/J2000) — the brightest star in Auriga and one of the most prominent golden stars of the northern sky.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffd68e',
        constellationId: 'ref:constellation:aur',
        distancePc: 13.1235,
        apparentMagnitude: 0.08,
        properMotionRaMasYr: 75.52,
        properMotionDecMasYr: -427.13,
        radialVelocityKmS: 22.2,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_CAPELLA_DEG,
                dec: DEC_CAPELLA_DEG
            }
        }
    }
} satisfies StarObj;
