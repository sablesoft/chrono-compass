import type { WheelSpec } from '../types';

export const season = {
    type: 'season',
    ready: true,
    info: [
        { defaultLabel: 'north solstice', spokes: ['N'], modal: 'North solstice is the moment when the north axis of the target is maximally directed toward the focus.' },
        { defaultLabel: 'south solstice', spokes: ['S'], modal: 'South solstice is the moment when the north axis of the target is maximally directed away from the focus.' },
        { defaultLabel: 'west equinox', spokes: ['W'], modal: 'West equinox is a neutral crossing where the north axis of the target is neither directed toward nor away from the focus.' },
        { defaultLabel: 'east equinox', spokes: ['E', 'E_next'], modal: 'East equinox is the complementary neutral crossing. In this wheel model it is used as both cycle start (E) and cycle end (E+).' },
        {
            defaultLabel: 'north activity rising',
            enabledStatic: false,
            spokes: ['SSE', 'SE', 'ESE', 'E_next', 'E', 'ENE', 'NE', 'NNE'],
            modal: 'This moment belongs to the half-cycle where solar activity on the target north hemisphere is increasing (from south-solstice side toward north-solstice side).'
        },
        {
            defaultLabel: 'south activity rising',
            enabledStatic: false,
            spokes: ['NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW'],
            modal: 'This moment belongs to the half-cycle where solar activity on the target south hemisphere is increasing (from north-solstice side toward south-solstice side).'
        },
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
