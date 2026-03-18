import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Gudja
const RA_GUDJA_DEG = hmsToDeg(15, 48, 44.377200);
const DEC_GUDJA_DEG = dmsToDeg(1, 18, 8, 29.630400);

export const Gudja = {
    id: 'ref:gudja',
    kind: 'star',
    name: 'Gudja',
    description: 'Gudja (ICRF/J2000) — bright star in Serpens Caput.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc494',
        constellationId: 'ref:constellation:ser1',
        distancePc: 117.096000,
        apparentMagnitude: 4.09,
        properMotionRaMasYr: -51.780,
        properMotionDecMasYr: -88.720,
        radialVelocityKmS: -39.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GUDJA_DEG,
                dec: DEC_GUDJA_DEG
            }
        }
    }
} satisfies StarObj;
