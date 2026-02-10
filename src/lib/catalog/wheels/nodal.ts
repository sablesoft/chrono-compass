import type { WheelSpec } from '../types';

export const NodalWheel: WheelSpec = {
    type: 'nodal',
    roles: [
        // Earth Nodal: Sun - Moon
        // This is the canonical nodal case available with only Sun/Earth/Moon.
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Moon']
        }
    ]
};