import type { WheelSpec } from '../types';

export const season = {
    type: 'season',
    ready: true,
    tags: [
        { value: 'north solstice', defaultEnabled: true, spokes: ['N'] },
        { value: 'south solstice', defaultEnabled: true, spokes: ['S'] },
        { value: 'west equinox', defaultEnabled: true, spokes: ['W'] },
        { value: 'east equinox', defaultEnabled: true, spokes: ['E', 'E_next'] },
    ],
    requiredRoles: {
        'focus' : ['engine_body'],
        'target' : ['engine_body']
    },
    ui: {
        'focus': 'center',
        'target': 'pointer',
    },
    roles: [
        // Sun Season: Earth
        {
            focus: ['Sun'],
            target: ['Earth']
        },
        // Earth Season: Moon (minimal MVP allowance; meaning is “axis of Moon relative to Earth”)
        // {
        //     focus: ['Earth'],
        //     target: ['Moon']
        // }
    ]
} satisfies Extract<WheelSpec, { type: 'season' }>;
