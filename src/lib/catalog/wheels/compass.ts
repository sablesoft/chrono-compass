import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    ready: true,
    multiTarget: true,
    mainCycle: 'horizon',
    nodes: {
        horizon: ['E-horizon',  'NE-horizon', 'N-horizon',  'NW-horizon', 'W-horizon',  'SW-horizon', 'S-horizon',  'SE-horizon', 'E_next-horizon',],
        compass: ['E-compass', 'NE-compass', 'N-compass', 'NW-compass', 'W-compass', 'SW-compass', 'S-compass', 'SE-compass',]
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
