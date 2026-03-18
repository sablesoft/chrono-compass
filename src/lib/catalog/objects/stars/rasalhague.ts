import { dmsToDeg, hmsToDeg, type StarObj } from '../../types';

// J2000 coordinates for Rasalhague
const RA_RASALHAGUE_DEG = hmsToDeg(17, 34, 56.1);
const DEC_RASALHAGUE_DEG = dmsToDeg(1, 12, 33, 36.0);

export const Rasalhague = {
    id: 'ref:rasalhague',
    kind: 'star',
    name: 'Rasalhague',
    description: 'Rasalhague (ICRF/J2000) — Alpha Ophiuchi, the bright head star of the Serpent Bearer and a prominent marker of Ophiuchus.',
    emoji: '✦',
    meta: {
        color: '#edf2ff',
        constellationId: 'ref:constellation:oph',
        distancePc: 14.8966,
        apparentMagnitude: 2.08,
        properMotionRaMasYr: 110.08,
        properMotionDecMasYr: -222.61,
        radialVelocityKmS: 12.6,
        direction: {
            frame: 'icrf_j2000',
            raDecDeg: {
                ra: RA_RASALHAGUE_DEG,
                dec: DEC_RASALHAGUE_DEG
            }
        }
    }
} satisfies StarObj;
