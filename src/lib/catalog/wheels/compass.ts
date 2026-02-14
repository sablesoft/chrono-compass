import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    multiTarget: true,
    requiredRoles: ['looker', 'target'],
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon', 'Mercury', 'Venus', "Mars", "Jupiter", "Neptune", "Pluto", "Saturn", "Uranus"]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'compass' }>;