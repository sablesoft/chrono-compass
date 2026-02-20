import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    requiredRoles: {
        'looker': ['reference'],
        'target': ['engine_body']
    },
    roles: [

    ]
} satisfies Extract<WheelSpec, { type: 'plato' }>;
