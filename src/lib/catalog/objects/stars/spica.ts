import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Spica
const RA_SPICA_DEG = hmsToDeg(13, 25, 11.58);
const DEC_SPICA_DEG = dmsToDeg(-1, 11, 9, 40.7);

export const Spica = {
    id: 'ref:spica',
    kind: 'star',
    name: 'Spica',
    description: 'Spica (ICRF/J2000) — the brightest star in Virgo and one of the classical zodiacal stars.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#cbd9ff',
        constellationId: 'ref:constellation:vir',
        distancePc: 76.5698,
        apparentMagnitude: 0.98,
        properMotionRaMasYr: -42.5,
        properMotionDecMasYr: -31.73,
        radialVelocityKmS: 1,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_SPICA_DEG,
                dec: DEC_SPICA_DEG
            }
        }
    }
} satisfies StarObj;
