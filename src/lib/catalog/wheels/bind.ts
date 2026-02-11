import type { WheelSpec } from '../types';

export const bind = {
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
} satisfies Extract<WheelSpec, { type: 'bind' }>;