import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Zubenelgenubi
const RA_ZUBENELGENUBI_DEG = hmsToDeg(14, 50, 52.717200);
const DEC_ZUBENELGENUBI_DEG = dmsToDeg(-1, 16, 2, 30.400800);

export const Zubenelgenubi = {
    id: 'ref:zubenelgenubi',
    kind: 'star',
    name: 'Zubenelgenubi',
    description: 'Zubenelgenubi (ICRF/J2000) — bright star in Libra.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d6e1ff',
        constellationId: 'ref:constellation:lib',
        distancePc: 23.239600,
        apparentMagnitude: 2.75,
        properMotionRaMasYr: -105.690,
        properMotionDecMasYr: -69.000,
        radialVelocityKmS: -46.700,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ZUBENELGENUBI_DEG,
                dec: DEC_ZUBENELGENUBI_DEG
            }
        }
    }
} satisfies StarObj;
