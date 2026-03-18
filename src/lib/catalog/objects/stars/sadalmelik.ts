import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Sadalmelik
const RA_SADALMELIK_DEG = hmsToDeg(22, 5, 47.036400);
const DEC_SADALMELIK_DEG = dmsToDeg(-1, 0, 19, 11.463600);

export const Sadalmelik = {
    id: 'ref:sadalmelik',
    kind: 'star',
    name: 'Sadalmelik',
    description: 'Sadalmelik (ICRF/J2000) — bright star in Aquarius.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe0c7',
        constellationId: 'ref:constellation:aqr',
        distancePc: 160.513600,
        apparentMagnitude: 2.95,
        properMotionRaMasYr: 17.900,
        properMotionDecMasYr: -9.930,
        radialVelocityKmS: 8.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SADALMELIK_DEG,
                dec: DEC_SADALMELIK_DEG
            }
        }
    }
} satisfies StarObj;
