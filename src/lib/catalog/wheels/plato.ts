import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    ready: true,
    tags: [
        { value: 'first quarter', defaultEnabled: true, spokes: ['E', "E_next"] },
        { value: 'waxing quadrature', defaultEnabled: true, spokes: ['E', "E_next"] },
        { value: 'opposition', defaultEnabled: true, spokes: ['N'] },
        { value: 'full phase', defaultEnabled: true, spokes: ['N'] },
        { value: 'last quarter', defaultEnabled: true, spokes: ['W'] },
        { value: 'waning quadrature', defaultEnabled: true, spokes: ['W'] },
        { value: 'conjunction', defaultEnabled: true, spokes: ['S'] },
        { value: 'new phase', defaultEnabled: true, spokes: ['S'] }
    ],
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
