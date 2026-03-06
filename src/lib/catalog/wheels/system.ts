import type { WheelSpec } from '../types';

export const system = {
    type: 'system',
    ready: true,
    multiTarget: true,
    mainCycle: 'synod',
    houseType: 'synod',
    nodes: {
        nodal: ['E-nodal', 'N-nodal', 'W-nodal', 'S-nodal', 'E_next-nodal'],
        bind: ['E-bind', 'N-bind', 'W-bind', 'S-bind', 'E_next-bind'],
        synod: ['E-synod', 'N-synod', 'W-synod', 'S-synod', 'E_next-synod']
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
