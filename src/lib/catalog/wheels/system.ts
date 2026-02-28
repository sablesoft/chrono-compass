import type { WheelSpec } from '../types';

export const system = {
    type: 'system',
    ready: true,
    multiTarget: true,
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
        }
    ]
} satisfies Extract<WheelSpec, { type: 'system' }>;
