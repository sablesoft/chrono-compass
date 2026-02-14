import type { WheelSpec } from '../types';

export const bind = {
    type: 'bind',
    requiredRoles: ['focus', 'target'],
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