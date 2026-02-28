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
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Neptune', 'Pluto', 'Saturn', 'Uranus']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'system' }>;
