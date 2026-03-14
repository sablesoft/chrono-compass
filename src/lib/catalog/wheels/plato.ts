import {REFERENCES, type WheelSpec} from '../types';

export const plato = {
    type: 'plato',
    ready: true,
    info: [
        { defaultLabel: 'first quarter', spokes: ['E', "E_next"], modal: 'First quarter marks a 90° phase offset in the cycle. It appears at both cycle boundaries in this wheel model.' },
        { defaultLabel: 'opposition', spokes: ['N'], modal: 'Opposition marks the phase where the target is opposite the reference direction in this cycle frame.' },
        { defaultLabel: 'full phase', enabledStatic: false, spokes: ['N'], modal: 'Full phase is the peak illumination-side state, paired with opposition in this cycle geometry.' },
        { defaultLabel: 'last quarter', spokes: ['W'], modal: 'Last quarter marks the opposite 90° phase offset from first quarter within the cycle.' },
        { defaultLabel: 'conjunction', spokes: ['S'], modal: 'Conjunction marks alignment in the cycle frame, opposite to opposition.' },
        { defaultLabel: 'new phase', enabledStatic: false, spokes: ['S'], modal: 'New phase is the minimal illumination-side state, paired with conjunction in this cycle geometry.' },
        {
            defaultLabel: 'waxing', enabledStatic: false,
            spokes: ['SSE', 'SE', 'ESE', 'E_next', 'E', 'ENE', 'NE', 'NNE'],
            modal: 'This moment belongs to the waxing interval, where phase progresses from new toward full.'
        },
        {
            defaultLabel: 'waning', enabledStatic: false,
            spokes: ['NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW'],
            modal: 'This moment belongs to the waning interval, where phase progresses from full back toward new.'
        }
    ],
    requiredRoles: {
        'looker': ['reference'],
        'target': ['engine_body']
    },
    ui: {
        'target': 'center',
    },
    roles: [
        {
            looker: REFERENCES,
            target : ['Earth']
        }
    ],
} satisfies Extract<WheelSpec, { type: 'plato' }>;
