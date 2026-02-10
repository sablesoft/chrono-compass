import type { WheelSpec } from '../types';

export const BindWheel: WheelSpec = {
    type: 'bind',
    roles: [
        // Sun Bind: Earth
        {
            focus: ['Sun'],
            target: ['Earth']
        },
        // Earth Bind: Moon
        {
            focus: ['Earth'],
            target: ['Moon']
        }
    ]
};