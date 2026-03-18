import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Arneb
const RA_ARNEB_DEG = hmsToDeg(5, 32, 43.814400);
const DEC_ARNEB_DEG = dmsToDeg(-1, 17, 49, 20.240400);

export const Arneb = {
    id: 'ref:arneb',
    kind: 'star',
    name: 'Arneb',
    description: 'Arneb (ICRF/J2000) — bright star in Lepus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#dce5ff',
        constellationId: 'ref:constellation:lep',
        distancePc: 680.272100,
        apparentMagnitude: 2.58,
        properMotionRaMasYr: 3.270,
        properMotionDecMasYr: 1.540,
        radialVelocityKmS: 24.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ARNEB_DEG,
                dec: DEC_ARNEB_DEG
            }
        }
    }
} satisfies StarObj;
