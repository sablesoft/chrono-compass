import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    multiTarget: true,
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'compass' }>;