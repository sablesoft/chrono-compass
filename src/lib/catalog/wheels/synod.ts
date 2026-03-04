// src/lib/catalog/wheels/synod.ts
import type { WheelSpec } from '../types';

export const synod = {
    type: 'synod',
    ready: true,
    info: [
        { defaultLabel: 'dist au', metaField: 'distanceAu', enabledStatic: false, format: 'au', spokes: '*', modal: 'Distance between focus and target in astronomical units (AU) at each synodic spoke.' },
        { defaultLabel: 'dist km', metaField: 'distanceKm', enabled: false, format: 'km', spokes: '*', modal: 'Distance between focus and target in kilometers at each synodic spoke.' },
        { defaultLabel: 'looker dist au', metaField: 'focusDistAu', enabled: false, format: 'au', spokes: '*', modal: 'Distance from looker to focus in AU, useful for observer-dependent synodic context.' },
        { defaultLabel: 'first quarter', spokes: ['E', "E_next"], modal: 'First quarter marks a 90° phase offset in the synodic cycle. It appears at both cycle boundaries in this wheel model.' },
        { defaultLabel: 'opposition', spokes: ['N'], modal: 'Opposition marks the synodic phase where target and focus are opposite as seen from the looker.' },
        { defaultLabel: 'full phase', enabledStatic: false, spokes: ['N'], modal: 'Full phase is the peak illumination-side state, typically aligned with opposition in this synodic model.' },
        { defaultLabel: 'last quarter', spokes: ['W'], modal: 'Last quarter marks the opposite 90° phase offset from first quarter within the synodic cycle.' },
        { defaultLabel: 'conjunction', spokes: ['S'], modal: 'Conjunction marks synodic alignment of focus and target as seen from the looker.' },
        { defaultLabel: 'new phase', enabledStatic: false, spokes: ['S'], modal: 'New phase is the minimal illumination-side state, typically aligned with conjunction in this synodic model.' },
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
        looker: ['engine_body', 'reference'],
        focus: ['engine_body'],
        target: ['engine_body'],
    },
    ui: {
        looker: 'S',
        focus: 'center',
        target: 'pointer',
    },
    roles: [
        // ------------------------------------------------------------
        // Baseline classics
        // ------------------------------------------------------------

        // Sun Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
        },
        {
            looker: ['Pluto'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
        },
        {
            looker: ['Neptune'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus'],
        },
        {
            looker: ['Uranus'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'],
        },
        {
            looker: ['Saturn'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter'],
        },
        {
            looker: ['Jupiter'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Mars'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus', 'Earth'],
        },
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Mercury', 'Venus'],
        },
        {
            looker: ['Venus'],
            focus: ['Sun'],
            target: ['Mercury'],
        },

        // Mercury Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Pluto'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Neptune'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Uranus'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Saturn'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Jupiter'],
            focus: ['Mercury'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Mars'],
            focus: ['Mercury'],
            target: ['Venus'],
        },

        // Venus Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Venus'],
            target: ['Earth', 'Mars'],
        },
        {
            looker: ['Pluto'],
            focus: ['Venus'],
            target: ['Earth', 'Mars', 'Jupiter'],
        },
        {
            looker: ['Neptune'],
            focus: ['Venus'],
            target: ['Earth', 'Mars'],
        },
        {
            looker: ['Uranus'],
            focus: ['Venus'],
            target: ['Earth', 'Mars'],
        },
        {
            looker: ['Saturn'],
            focus: ['Venus'],
            target: ['Earth', 'Mars', 'Jupiter'],
        },
        {
            looker: ['Jupiter'],
            focus: ['Venus'],
            target: ['Earth', 'Mars'],
        },

        // Earth Focus
        {
            looker: ['Sun'],
            focus: ['Earth'],
            target: ['Moon'],
        },
        {
            looker: ['ref:galactic-center'],
            focus: ['Earth'],
            target: ['Mars'],
        },
        {
            looker: ['Pluto'],
            focus: ['Earth'],
            target: ['Mars'],
        },
        {
            looker: ['Neptune'],
            focus: ['Earth'],
            target: ['Mars'],
        },
        {
            looker: ['Uranus'],
            focus: ['Earth'],
            target: ['Mars'],
        },
        {
            looker: ['Saturn'],
            focus: ['Earth'],
            target: ['Mars'],
        },
        {
            looker: ['Jupiter'],
            focus: ['Earth'],
            target: ['Mars'],
        },

        // Mars Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Mars'],
            target: ['Jupiter'],
        },
        {
            looker: ['Pluto'],
            focus: ['Mars'],
            target: ['Jupiter'],
        },
        {
            looker: ['Neptune'],
            focus: ['Mars'],
            target: ['Jupiter'],
        },
        {
            looker: ['Uranus'],
            focus: ['Mars'],
            target: ['Jupiter'],
        },

        // Jupiter Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Jupiter'],
            target: ['Saturn'],
        },
        {
            looker: ['Pluto'],
            focus: ['Jupiter'],
            target: ['Saturn'],
        },
        {
            looker: ['Neptune'],
            focus: ['Jupiter'],
            target: ['Saturn'],
        },

        // Saturn Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Saturn'],
            target: ['Uranus', 'Pluto'],
        },
        {
            looker: ['Neptune'],
            focus: ['Saturn'],
            target: ['Uranus'],
        },

        // Uranus Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Uranus'],
            target: ['Neptune', 'Pluto'],
        },

        // Neptune Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Neptune'],
            target: ['Pluto'],
        },

        // Moon Focus
        {
            looker: ['ref:galactic-center'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Earth','Mars'],
        },
        {
            looker: ['Pluto'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Mars'],
        },
        {
            looker: ['Neptune'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Mars'],
        },
        {
            looker: ['Uranus'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Earth','Mars'],
        },
        {
            looker: ['Saturn'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Earth','Mars'],
        },
        {
            looker: ['Jupiter'],
            focus: ['Moon'],
            target: ['Sun','Mercury','Venus','Mars'],
        },
        {
            looker: ['Mars'],
            focus: ['Moon'],
            target: ['Sun','Venus','Earth'],
        },
    ],
} satisfies Extract<WheelSpec, { type: 'synod' }>;
