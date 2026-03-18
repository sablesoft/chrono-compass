import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Diadem
const RA_DIADEM_DEG = hmsToDeg(13, 9, 59.288400);
const DEC_DIADEM_DEG = dmsToDeg(1, 17, 31, 45.951600);

export const Diadem = {
    id: 'ref:diadem',
    kind: 'star',
    name: 'Diadem',
    description: 'Diadem (ICRF/J2000) — bright star in Coma Berenices.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#fffcff',
        constellationId: 'ref:constellation:com',
        distancePc: 17.825300,
        apparentMagnitude: 4.32,
        properMotionRaMasYr: -445.950,
        properMotionDecMasYr: 129.690,
        radialVelocityKmS: -11.600,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DIADEM_DEG,
                dec: DEC_DIADEM_DEG
            }
        }
    }
} satisfies StarObj;
