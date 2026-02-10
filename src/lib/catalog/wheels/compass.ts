import type { WheelSpec } from '../types';

export const CompassWheel: WheelSpec = {
    type: 'compass',
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon']
        }
    ]
};