import type { WheelSpec } from '../types';

export const system = {
    type: 'system',
    ready: true,
    multiTarget: true,
    nodes: {
        seam: ['E-nodal', 'W-nodal', 'N-nodal', 'S-nodal'],
        bind: ['N-bind', 'S-bind', 'E-bind', 'E_next-bind', 'W-bind'],
        synod: ['N-synod', 'W-synod', 'S-synod']
    },
    ui: {
        'focus': 'center',
        'looker': 'S',
    },
    requiredRoles: {
        'looker' : ['reference'],
        'focus' : ['engine_body'],
        'target' : ['engine_body'],
    },
    roles: [
        {
            looker: ['ref:galactic-center'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',]
        },
        {
            looker: ['Sun'],
            focus: ['Earth'],
            target: ['Moon',]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'system' }>;
