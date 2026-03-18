import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Naos
const RA_NAOS_DEG = hmsToDeg(8, 3, 35.053200);
const DEC_NAOS_DEG = dmsToDeg(-1, 40, 0, 11.332800);

export const Naos = {
    id: 'ref:naos',
    kind: 'star',
    name: 'Naos',
    description: 'Naos (ICRF/J2000) — bright star in Puppis.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#b4ccff',
        constellationId: 'ref:constellation:pup',
        distancePc: 332.225900,
        apparentMagnitude: 2.21,
        properMotionRaMasYr: -30.820,
        properMotionDecMasYr: 16.770,
        radialVelocityKmS: -24.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_NAOS_DEG,
                dec: DEC_NAOS_DEG
            }
        }
    }
} satisfies StarObj;
