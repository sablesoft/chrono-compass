import type { WheelSpec } from '../types';

export const season = {
    type: 'season',
    requiredRoles: {
        'focus' : ['engine_body'],
        'target' : ['engine_body']
    },
    roles: [
        // Sun Season: Earth
        {
            focus: ['Sun'],
            target: ['Earth']
        },
        // Earth Season: Moon (minimal MVP allowance; meaning is “axis of Moon relative to Earth”)
        {
            focus: ['Earth'],
            target: ['Moon']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'season' }>;
