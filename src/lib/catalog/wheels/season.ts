import type { WheelSpec } from '../types';

export const season = {
    type: 'season',
    ready: true,
    info: [
        { defaultLabel: 'north solstice', spokes: ['N'] },
        { defaultLabel: 'south solstice', spokes: ['S'] },
        { defaultLabel: 'west equinox', spokes: ['W'] },
        { defaultLabel: 'east equinox', spokes: ['E', 'E_next'] },
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
