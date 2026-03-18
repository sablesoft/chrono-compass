import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alkaid
const RA_ALKAID_DEG = hmsToDeg(13, 47, 32.474400);
const DEC_ALKAID_DEG = dmsToDeg(1, 49, 18, 47.754000);

export const Alkaid = {
    id: 'ref:alkaid',
    kind: 'star',
    name: 'Alkaid',
    description: 'Alkaid (ICRF/J2000) — bright star in Ursa Major.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#c1d5ff',
        constellationId: 'ref:constellation:uma',
        distancePc: 31.867400,
        apparentMagnitude: 1.85,
        properMotionRaMasYr: -121.230,
        properMotionDecMasYr: -15.560,
        radialVelocityKmS: -11.000,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALKAID_DEG,
                dec: DEC_ALKAID_DEG
            }
        }
    }
} satisfies StarObj;
