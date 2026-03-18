import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Deneb Algedi
const RA_DENEBALGEDI_DEG = hmsToDeg(21, 47, 2.439600);
const DEC_DENEBALGEDI_DEG = dmsToDeg(-1, 16, 7, 38.229600);

export const DenebAlgedi = {
    id: 'ref:deneb-algedi',
    kind: 'star',
    name: 'Deneb Algedi',
    description: 'Deneb Algedi (ICRF/J2000) — bright star in Capricornus.',
    emoji: '✶',
    emojiScale: 1,
    meta: {
        color: '#d9e3ff',
        constellationId: 'ref:constellation:cap',
        distancePc: 11.866600,
        apparentMagnitude: 2.85,
        properMotionRaMasYr: 263.260,
        properMotionDecMasYr: -296.230,
        radialVelocityKmS: -6.300,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_DENEBALGEDI_DEG,
                dec: DEC_DENEBALGEDI_DEG
            }
        }
    }
} satisfies StarObj;
