import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Ascella
const RA_ASCELLA_DEG = hmsToDeg(19, 2, 36.715200);
const DEC_ASCELLA_DEG = dmsToDeg(-1, 29, 52, 48.378000);

export const Ascella = {
    id: 'ref:ascella',
    kind: 'star',
    name: 'Ascella',
    description: 'Ascella (ICRF/J2000) — bright star in Sagittarius.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ceddff',
        constellationId: 'ref:constellation:sgr',
        distancePc: 27.041600,
        apparentMagnitude: 2.60,
        properMotionRaMasYr: -14.100,
        properMotionDecMasYr: 3.660,
        radialVelocityKmS: 22.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ASCELLA_DEG,
                dec: DEC_ASCELLA_DEG
            }
        }
    }
} satisfies StarObj;
