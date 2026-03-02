import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    ready: true,
    multiTarget: true,
    nodes: {
        seam: ['N-horizon', 'W-horizon', 'S-horizon']
    },
    requiredRoles: {
        'looker' : ['engine_body'],
        'target' : ['engine_body']
    },
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon', 'Mercury', 'Venus', "Mars", "Jupiter", "Neptune", "Pluto", "Saturn", "Uranus"]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'compass' }>;
