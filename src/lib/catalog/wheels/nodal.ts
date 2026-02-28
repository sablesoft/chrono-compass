import type { WheelSpec } from '../types';

export const nodal = {
    type: 'nodal',
    ready: true,
    ui: {
        looker: ['E-spoke', 'W-spoke'],
        focus: 'center',
        target: 'pointer',
    },
    requiredRoles: {
        looker: ['engine_body', 'reference'],
        focus: ['engine_body', 'reference'],
        target: ['engine_body'],
    },
    roles: [
        // Canonical draconic lunar cycle.
        {
            looker: [
                'Sun',
                // 'ref:ecliptic-axis'
            ],
            focus: ['Earth'],
            target: ['Moon']
        },

        // Planetary nodes relative to ecliptic-like references.
        {
            looker: ['Earth'],
            focus: [
                'Sun',
                // 'ref:ecliptic-axis'
            ],
            target: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
        },
    ]
} satisfies Extract<WheelSpec, { type: 'nodal' }>;
