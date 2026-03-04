import type { WheelSpec } from '../types';

export const nodal = {
    type: 'nodal',
    ready: true,
    info: [
        { defaultLabel: 'latitude', metaField: 'nodalLatitudeDeg', format: 'deg', spokes: '*' },
        { defaultLabel: 'dist au', metaField: 'distanceAu', format: 'au', spokes: '*' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', format: 'km', spokes: '*' },
        { defaultLabel: 'ascending node', spokes: ['E', 'E_next'] },
        { defaultLabel: 'descending node', spokes: ['W'] },
        { defaultLabel: 'max latitude', spokes: ['N'] },
        { defaultLabel: 'min latitude', spokes: ['S'] },
        { defaultLabel: 'north apex', spokes: ['N'] },
        { defaultLabel: 'south nadir', spokes: ['S'] },
        { defaultLabel: 'north side', spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'] },
        { defaultLabel: 'south side', spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] },
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
