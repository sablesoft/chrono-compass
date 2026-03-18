import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Vindemiatrix
const RA_VINDEMIATRIX_DEG = hmsToDeg(13, 2, 10.600800);
const DEC_VINDEMIATRIX_DEG = dmsToDeg(1, 10, 57, 32.940000);

export const Vindemiatrix = {
    id: 'ref:vindemiatrix',
    kind: 'star',
    name: 'Vindemiatrix',
    description: 'Vindemiatrix (ICRF/J2000) — bright star in Virgo.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#ffe2cb',
        constellationId: 'ref:constellation:vir',
        distancePc: 33.602200,
        apparentMagnitude: 2.85,
        properMotionRaMasYr: -275.050,
        properMotionDecMasYr: 19.960,
        radialVelocityKmS: -14.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_VINDEMIATRIX_DEG,
                dec: DEC_VINDEMIATRIX_DEG
            }
        }
    }
} satisfies StarObj;
