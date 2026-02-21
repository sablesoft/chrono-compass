import type { WheelSpec } from '../types';

export const system = {
    type: 'system',
    ready: false,
    multiTarget: true,
    requiredRoles: {
        'looker' : ['reference'],
        'focus' : ['engine_body'],
        'target' : ['engine_body'],
    },
    roles: [
    ]
} satisfies Extract<WheelSpec, { type: 'system' }>;
