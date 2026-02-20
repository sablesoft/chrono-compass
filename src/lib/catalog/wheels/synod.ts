import type { WheelSpec } from '../types';

export const synod = {
    type: 'synod',
    ready: true,
    requiredRoles: {
        'looker' : ['engine_body'],
        'focus' : ['engine_body', 'reference'],
        'target' : ['engine_body']
    },
    ui: {
        looker: 'center',
        focus: 'S',
        target: 'pointer',
    },
    roles: [
        // Earth Synod: Sun - Moon (classic synodic relation as seen from Earth)
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Moon']
        },

        // Moon Synod: Sun - Earth (Earth phases as seen from the Moon)
        {
            looker: ['Moon'],
            focus: ['Sun'],
            target: ['Earth']
        },

        // Sun Synod: GC - Planet (Planets phases around Sun as seen from the GC)
        {
            looker: ['Sun'],
            focus: ['ref:galactic-center'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
        },
    ]
} satisfies Extract<WheelSpec, { type: 'synod' }>;
