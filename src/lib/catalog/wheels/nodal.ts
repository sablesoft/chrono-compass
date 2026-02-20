import type { WheelSpec } from '../types';

export const nodal = {
    type: 'nodal',
    requiredRoles: {
        'looker' : ['engine_body'],
        'focus' : ['engine_body'],
        'target' : ['engine_body']
    },
    roles: [
        // Earth Nodal: Sun - Moon
        // This is the canonical nodal case available with only Sun/Earth/Moon.
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Moon']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'nodal' }>;
