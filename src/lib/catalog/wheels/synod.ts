import type { WheelSpec } from '../types';

export const synod = {
    type: 'synod',
    ready: true,
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
