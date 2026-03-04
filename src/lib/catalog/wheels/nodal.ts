import type { WheelSpec } from '../types';

export const nodal = {
    type: 'nodal',
    ready: true,
    info: [
        { defaultLabel: 'latitude', metaField: 'nodalLatitudeDeg', enabledStatic: false,  format: 'deg', spokes: '*', modal: 'Nodal latitude is the angular offset of the target from the selected reference plane. Positive and negative values indicate opposite sides of that plane.' },
        { defaultLabel: 'dist au', metaField: 'distanceAu', enabledStatic: false, format: 'au', spokes: '*', modal: 'Distance between the target and the nodal origin body in astronomical units (AU).' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', enabled: false, format: 'km', spokes: '*', modal: 'Distance between the target and the nodal origin body in kilometers.' },
        { defaultLabel: 'plane dist au', metaField: 'planeDistanceAu', enabledStatic: false, format: 'au', spokes: '*', modal: 'Signed distance from the target to the reference plane in AU. Positive and negative values indicate opposite sides of the plane.' },
        { defaultLabel: 'plane dist km', metaField: 'planeDistanceAu', enabled: false, format: 'km', spokes: '*', modal: 'Signed distance from the target to the reference plane in kilometers. Positive and negative values indicate opposite sides of the plane.' },
        { defaultLabel: 'ascending node', spokes: ['E', 'E_next'], modal: 'Ascending node marks the upward crossing of the reference plane, where nodal latitude changes from negative to positive.' },
        { defaultLabel: 'descending node', spokes: ['W'], modal: 'Descending node marks the downward crossing of the reference plane, where nodal latitude changes from positive to negative.' },
        { defaultLabel: 'max latitude', enabledStatic: false, spokes: ['N'], modal: 'Maximum nodal latitude is the peak positive offset from the reference plane within the current nodal cycle.' },
        { defaultLabel: 'min latitude', enabledStatic: false, spokes: ['S'], modal: 'Minimum nodal latitude is the peak negative offset from the reference plane within the current nodal cycle.' },
        { defaultLabel: 'north apex', spokes: ['N'], modal: 'North apex is the cycle sector around the highest positive nodal latitude.' },
        { defaultLabel: 'south nadir', spokes: ['S'], modal: 'South nadir is the cycle sector around the lowest negative nodal latitude.' },
        { defaultLabel: 'north side', enabledStatic: false, spokes: ['ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW'], modal: 'This moment belongs to the interval where nodal latitude is on the north/positive side of the reference plane.' },
        { defaultLabel: 'south side', enabledStatic: false, spokes: ['WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'], modal: 'This moment belongs to the interval where nodal latitude is on the south/negative side of the reference plane.' },
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
