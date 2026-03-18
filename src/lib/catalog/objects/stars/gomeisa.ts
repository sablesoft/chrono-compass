import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Gomeisa
const RA_GOMEISA_DEG = hmsToDeg(7, 27, 9.043200);
const DEC_GOMEISA_DEG = dmsToDeg(1, 8, 17, 21.534000);

export const Gomeisa = {
    id: 'ref:gomeisa',
    kind: 'star',
    name: 'Gomeisa',
    description: 'Gomeisa (ICRF/J2000) — bright star in Canis Minor.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c1d5ff',
        constellationId: 'ref:constellation:cmi',
        distancePc: 49.578600,
        apparentMagnitude: 2.89,
        properMotionRaMasYr: -50.280,
        properMotionDecMasYr: -38.450,
        radialVelocityKmS: 22.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_GOMEISA_DEG,
                dec: DEC_GOMEISA_DEG
            }
        }
    }
} satisfies StarObj;
