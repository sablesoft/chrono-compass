import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    ready: true,
    requiredRoles: {
        'looker': ['reference'],
        'target': ['engine_body']
    },
    ui: {
        'looker': 'S',
        'target': 'center',
    },
    roles: [
        {
            'looker': ['ref:galactic-center'],
            'target': ['Earth']
        }
    ],
} satisfies Extract<WheelSpec, { type: 'plato' }>;
