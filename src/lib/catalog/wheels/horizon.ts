import type { WheelSpec } from '../types';

export const horizon = {
    type: 'horizon',
    ready: true,
    tags: [
            { value: 'rising horizon', defaultEnabled: true, spokes: ['E', "E_next"] },
            { value: 'setting horizon', defaultEnabled: true, spokes: ['W'] },
            { value: 'max altitude', defaultEnabled: true, spokes: ['N'] },
            { value: 'min altitude', defaultEnabled: true, spokes: ['S'] },
            { value: 'zenith', defaultEnabled: true, spokes: ['N'] },
            { value: 'nadir', defaultEnabled: true, spokes: ['S'] },
            { value: 'above horizon', defaultEnabled: true, spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'] },
            { value: 'below horizon', defaultEnabled: true, spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] },
            { value: 'N-horizon', defaultEnabled: true, spokes: ['N'] },
            { value: 'S-horizon', defaultEnabled: true, spokes: ['S'] },
            { value: 'W-horizon', defaultEnabled: true, spokes: ['W'] }
    ],
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
