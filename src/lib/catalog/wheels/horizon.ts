import type { WheelSpec } from '../types';

export const horizon = {
    type: 'horizon',
    ready: true,
    info: [
        { defaultLabel: 'altitude', metaField: 'altitudeDeg', format: 'deg', spokes: '*' },
        { defaultLabel: 'azimuth', metaField: 'azimuthDeg', format: 'deg', enabled: false, spokes: '*' },
        { defaultLabel: 'ra hours', metaField: 'raHours', format: 'deg2', enabled: false, spokes: '*' },
        { defaultLabel: 'declination', metaField: 'decDeg', format: 'deg',enabled: false, spokes: '*' },
        { defaultLabel: 'dist au', metaField: 'distanceAu', format: 'au', enabled: false, spokes: '*' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', format: 'km', enabled: false, spokes: '*' },
        { defaultLabel: 'rising horizon', spokes: ['E', "E_next"] },
        { defaultLabel: 'setting horizon', spokes: ['W'] },
        { defaultLabel: 'max altitude', spokes: ['N'] },
        { defaultLabel: 'min altitude', spokes: ['S'] },
        { defaultLabel: 'zenith', spokes: ['N'] },
        { defaultLabel: 'nadir', spokes: ['S'] },
        { defaultLabel: 'above horizon', spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'] },
        { defaultLabel: 'below horizon', spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] },
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
