import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    multiTarget: true,
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon', 'Mercury', 'Venus', "Mars", "Jupiter", "Neptune", "Pluto", "Saturn", "Uranus"]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'compass' }>;