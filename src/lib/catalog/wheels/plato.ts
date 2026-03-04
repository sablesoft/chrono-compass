import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    ready: true,
    info: [
        { defaultLabel: 'first quarter', spokes: ['E', "E_next"] },
        { defaultLabel: 'waxing quadrature', spokes: ['E', "E_next"] },
        { defaultLabel: 'opposition', spokes: ['N'] },
        { defaultLabel: 'full phase', spokes: ['N'] },
        { defaultLabel: 'last quarter', spokes: ['W'] },
        { defaultLabel: 'waning quadrature', spokes: ['W'] },
        { defaultLabel: 'conjunction', spokes: ['S'] },
        { defaultLabel: 'new phase', spokes: ['S'] }
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
