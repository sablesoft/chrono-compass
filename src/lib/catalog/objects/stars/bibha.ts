import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Bibhā
const RA_BIBHA_DEG = hmsToDeg(9, 56, 5.917200);
const DEC_BIBHA_DEG = dmsToDeg(-1, 3, 48, 30.319200);

export const Bibha = {
    id: 'ref:bibha',
    kind: 'star',
    name: 'Bibhā',
    description: 'Bibhā (ICRF/J2000) — bright star in Sextans.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fff2e5',
        constellationId: 'ref:constellation:sex',
        distancePc: 95.328900,
        apparentMagnitude: 8.73,
        properMotionRaMasYr: -67.220,
        properMotionDecMasYr: 17.020,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_BIBHA_DEG,
                dec: DEC_BIBHA_DEG
            }
        }
    }
} satisfies StarObj;
