import type { WheelSpec } from '../types';

export const horizon = {
    type: 'horizon',
    ready: true,
    info: [
        { defaultLabel: 'altitude', metaField: 'altitudeDeg', format: 'deg', enabledStatic: false, spokes: '*', modal: 'Altitude is the target height relative to the local horizon. Positive values mean the body is above the horizon, negative values mean it is below.' },
        { defaultLabel: 'azimuth', metaField: 'azimuthDeg', format: 'deg', enabled: true, spokes: '*', modal: 'Azimuth is the horizontal direction along the horizon, measured clockwise from true north: N=0°, E=90°, S=180°, W=270°.' },
        { defaultLabel: 'ra hours', metaField: 'raHours', format: 'deg2', enabled: false, spokes: '*', modal: 'Right ascension is an equatorial sky coordinate, similar to celestial longitude. It is commonly expressed in hours along the celestial equator.' },
        { defaultLabel: 'declination', metaField: 'decDeg', format: 'deg', enabled: false, spokes: '*', modal: 'Declination is an equatorial sky coordinate, similar to celestial latitude. Positive values are north of the celestial equator, negative values are south.' },
        { defaultLabel: 'dist au', metaField: 'distanceAu', format: 'au', enabled: false, spokes: '*', modal: 'Distance in astronomical units (AU). 1 AU is the average Earth-Sun distance, useful for comparing orbital scales.' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', format: 'km', enabled: false, spokes: '*', modal: 'Distance in kilometers for precise range tracking at the selected horizon moment.' },
        { defaultLabel: 'rising horizon', spokes: ['E', "E_next"], modal: 'Rising horizon marks the upward crossing of altitude 0°. These moments define when the target appears above the horizon line.' },
        { defaultLabel: 'setting horizon', spokes: ['W'], modal: 'Setting horizon marks the downward crossing of altitude 0°, when the target disappears below the horizon line.' },
        { defaultLabel: 'max altitude', enabledStatic: false, spokes: ['N'], modal: 'Maximum altitude is the highest point of the target above the horizon within the current horizon cycle.' },
        { defaultLabel: 'min altitude', enabledStatic: false, spokes: ['S'], modal: 'Minimum altitude is the lowest point of the target below the horizon within the current horizon cycle.' },
        { defaultLabel: 'top culmination', spokes: ['N'], modal: 'Top culmination sector marks the local top-side arc of the cycle where altitude reaches its peak behavior.' },
        { defaultLabel: 'bottom culmination', spokes: ['S'], modal: 'Bottom culmination sector marks the local bottom-side arc of the cycle where altitude reaches its minimum behavior.' },
        { defaultLabel: 'above horizon', enabledStatic: false, spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'], modal: 'This moment belongs to the interval where the target remains above the local horizon.' },
        { defaultLabel: 'below horizon', enabledStatic: false, spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'], modal: 'This moment belongs to the interval where the target remains below the local horizon.' },
    ],
    ui: {
      'target': 'pointer',
    },
    requiredRoles: {
        'looker' : ['engine_body'],
        'target' : ['engine_body', 'reference']
    },
    roles: [
        // Earth Horizon: Sun / Moon
        // (For a typical Earth surface observer both cross the horizon; polar edge cases exist,
        // but at this MVP level we allow the pair.)
        {
            looker: ['Earth'],
            target: [
                'Sun', 'Moon', 'Mercury', 'Venus', "Mars", "Jupiter", "Neptune", "Pluto", "Saturn", "Uranus",

                // orientations:
                'ref:galactic-center',

                // stars:
                'ref:polaris',
                'ref:sirius',
                'ref:betelgeuse',
                'ref:antares',
                'ref:deneb',
                'ref:altair',
                'ref:nunki',

                // Southern Cross:
                'ref:acrux',
                'ref:mimosa',
                'ref:imai',
                'ref:gacrux',
            ]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'horizon' }>;
