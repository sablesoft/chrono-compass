import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Poerava
const RA_POERAVA_DEG = hmsToDeg(23, 31, 20.244000);
const DEC_POERAVA_DEG = dmsToDeg(-1, 58, 12, 35.038800);

export const Poerava = {
    id: 'ref:poerava',
    kind: 'star',
    name: 'Poerava',
    description: 'Poerava (ICRF/J2000) — bright star in Tucana.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fffbf6',
        constellationId: 'ref:constellation:tuc',
        distancePc: 55.279200,
        apparentMagnitude: 7.82,
        properMotionRaMasYr: 181.400,
        properMotionDecMasYr: -5.590,
        radialVelocityKmS: 0.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_POERAVA_DEG,
                dec: DEC_POERAVA_DEG
            }
        }
    }
} satisfies StarObj;
