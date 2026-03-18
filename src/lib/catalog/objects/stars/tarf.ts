import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Tarf
const RA_TARF_DEG = hmsToDeg(8, 16, 30.921600);
const DEC_TARF_DEG = dmsToDeg(1, 9, 11, 7.962000);

export const Tarf = {
    id: 'ref:tarf',
    kind: 'star',
    name: 'Tarf',
    description: 'Tarf (ICRF/J2000) — bright star in Cancer.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffc99e',
        constellationId: 'ref:constellation:cnc',
        distancePc: 93.023300,
        apparentMagnitude: 3.53,
        properMotionRaMasYr: -46.800,
        properMotionDecMasYr: -48.650,
        radialVelocityKmS: 22.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_TARF_DEG,
                dec: DEC_TARF_DEG
            }
        }
    }
} satisfies StarObj;
