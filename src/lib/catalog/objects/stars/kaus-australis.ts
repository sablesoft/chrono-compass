import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Kaus Australis
const RA_KAUS_AUSTRALIS_DEG = hmsToDeg(18, 24, 10.3);
const DEC_KAUS_AUSTRALIS_DEG = dmsToDeg(-1, 34, 23, 4.6);

export const KausAustralis = {
    id: 'ref:kaus-australis',
    kind: 'star',
    name: 'Kaus Australis',
    description: 'Kaus Australis (ICRF/J2000) — the brightest star in Sagittarius and a well-known arrow-marking star of the Archer.',
    emoji: '✦',
    meta: {
        color: '#e2ddff',
        constellationId: 'ref:constellation:sgr',
        distancePc: 43.9366,
        apparentMagnitude: 1.79,
        properMotionRaMasYr: -39.61,
        properMotionDecMasYr: -124.05,
        radialVelocityKmS: -15,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_KAUS_AUSTRALIS_DEG,
                dec: DEC_KAUS_AUSTRALIS_DEG
            }
        }
    }
} satisfies StarObj;
