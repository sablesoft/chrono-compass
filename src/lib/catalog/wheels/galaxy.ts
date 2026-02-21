import type { WheelSpec } from '../types';

export const galaxy = {
    type: 'galaxy',
    ready: false,
    multiTarget: true,
    requiredRoles: {
        'looker' : ['reference'],
        'focus' : ['reference'],
        'target' : ['reference'],
    },
    roles: [
    ]
} satisfies Extract<WheelSpec, { type: 'galaxy' }>;
