import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Alderamin
const RA_ALDERAMIN_DEG = hmsToDeg(21, 18, 34.668000);
const DEC_ALDERAMIN_DEG = dmsToDeg(1, 62, 35, 8.062800);

export const Alderamin = {
    id: 'ref:alderamin',
    kind: 'star',
    name: 'Alderamin',
    description: 'Alderamin (ICRF/J2000) — bright star in Cepheus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#e1e8ff',
        constellationId: 'ref:constellation:cep',
        distancePc: 15.037600,
        apparentMagnitude: 2.45,
        properMotionRaMasYr: 149.910,
        properMotionDecMasYr: 48.270,
        radialVelocityKmS: -11.500,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_ALDERAMIN_DEG,
                dec: DEC_ALDERAMIN_DEG
            }
        }
    }
} satisfies StarObj;
