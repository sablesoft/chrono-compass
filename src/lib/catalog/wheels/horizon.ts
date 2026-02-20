import type { WheelSpec } from '../types';

export const horizon = {
    type: 'horizon',
    ready: true,
    ui: {
      'target': 'pointer',
    },
    requiredRoles: {
        'looker' : ['engine_body'],
        'target' : ['engine_body']
    },
    roles: [
        // Earth Horizon: Sun / Moon
        // (For a typical Earth surface observer both cross the horizon; polar edge cases exist,
        // but at this MVP level we allow the pair.)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon', 'Mercury', 'Venus', "Mars", "Jupiter", "Neptune", "Pluto", "Saturn", "Uranus"]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'horizon' }>;