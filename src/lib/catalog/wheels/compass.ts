import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    ready: true,
    multiTarget: true,
    info: [
        { defaultLabel: 'east', spokes: ['E', "E_next"] },
        { defaultLabel: 'north-east', spokes: ['NE'] },
        { defaultLabel: 'north', spokes: ['N'] },
        { defaultLabel: 'north-west', spokes: ['NW'] },
        { defaultLabel: 'west', spokes: ['W'] },
        { defaultLabel: 'south-west', spokes: ['SW'] },
        { defaultLabel: 'south', spokes: ['S'] },
        { defaultLabel: 'south-east', spokes: ['SE'] },
    ],
    nodes: {
        boundary: ['E-horizon', 'E_next-horizon'],
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
