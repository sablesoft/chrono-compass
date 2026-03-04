import type { WheelSpec } from '../types';

export const horizon = {
    type: 'horizon',
    ready: true,
    info: [
        { defaultLabel: 'altitude', metaField: 'altitudeDeg', format: 'deg', spokes: '*' },
        { defaultLabel: 'azimuth', metaField: 'azimuthDeg', format: 'deg', spokes: '*' },
        { defaultLabel: 'ra hours', metaField: 'raHours', format: 'deg2', spokes: '*' },
        { defaultLabel: 'declination', metaField: 'decDeg', format: 'deg', spokes: '*' },
        { defaultLabel: 'dist au', metaField: 'distanceAu', format: 'au', spokes: '*' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', format: 'km', spokes: '*' },
        { defaultLabel: 'rising horizon', spokes: ['E', "E_next"] },
        { defaultLabel: 'setting horizon', spokes: ['W'] },
        { defaultLabel: 'max altitude', spokes: ['N'] },
        { defaultLabel: 'min altitude', spokes: ['S'] },
        { defaultLabel: 'zenith', spokes: ['N'] },
        { defaultLabel: 'nadir', spokes: ['S'] },
        { defaultLabel: 'above horizon', spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'] },
        { defaultLabel: 'below horizon', spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] },
        { defaultLabel: 'N-horizon', spokes: ['N'] },
        { defaultLabel: 'S-horizon', spokes: ['S'] },
        { defaultLabel: 'W-horizon', spokes: ['W'] }
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
