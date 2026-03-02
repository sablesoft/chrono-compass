import type { WheelSpec } from '../types';

export const nodal = {
    type: 'nodal',
    ready: true,
    tags: [
            { value: 'ascending node', defaultEnabled: true, spokes: ['E', 'E_next'] },
            { value: 'descending node', defaultEnabled: true, spokes: ['W'] },
            { value: 'max latitude', defaultEnabled: true, spokes: ['N'] },
            { value: 'min latitude', defaultEnabled: true, spokes: ['S'] },
            { value: 'north apex', defaultEnabled: true, spokes: ['N'] },
            { value: 'south nadir', defaultEnabled: true, spokes: ['S'] },
            { value: 'north side', defaultEnabled: true, spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'] },
            { value: 'south side', defaultEnabled: true, spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] },
    ],
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
