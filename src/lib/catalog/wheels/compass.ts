import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    ready: true,
    multiTarget: true,
    tags: [
        { value: 'east', defaultEnabled: true, spokes: ['E', "E_next"] },
        { value: 'north-east', defaultEnabled: true, spokes: ['NE'] },
        { value: 'north', defaultEnabled: true, spokes: ['N'] },
        { value: 'north-west', defaultEnabled: true, spokes: ['NW'] },
        { value: 'west', defaultEnabled: true, spokes: ['W'] },
        { value: 'south-west', defaultEnabled: true, spokes: ['SW'] },
        { value: 'south', defaultEnabled: true, spokes: ['S'] },
        { value: 'south-east', defaultEnabled: true, spokes: ['SE'] },
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
