import type { WheelSpec } from '../types';

export const synod = {
    type: 'synod',
    ready: true,
    requiredRoles: {
        looker: ['engine_body'],
        focus: ['engine_body', 'reference'],
        target: ['engine_body'],
    },
    ui: {
        looker: 'center',
        focus: 'S',
        target: 'pointer',
    },
    roles: [
        // ------------------------------------------------------------
        // Baseline classics
        // ------------------------------------------------------------

        // Sun Looker
        {
            looker: ['Sun'],
            focus: ['ref:galactic-center'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
        },
        {
            looker: ['Sun'],
            focus: ['Pluto'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
        },
        {
            looker: ['Sun'],
            focus: ['Neptune'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus'],
        },
        {
            looker: ['Sun'],
            focus: ['Uranus'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'],
        },
        {
            looker: ['Sun'],
            focus: ['Saturn'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter'],
        },
        {
            looker: ['Sun'],
            focus: ['Jupiter'],
            target: ['Mercury', 'Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Sun'],
            focus: ['Mars'],
            target: ['Mercury', 'Venus', 'Earth'],
        },
        {
            looker: ['Sun'],
            focus: ['Earth'],
            target: ['Mercury', 'Venus'],
        },
        {
            looker: ['Sun'],
            focus: ['Venus'],
            target: ['Mercury'],
        },

        // Mercury Looker
        {
            looker: ['Mercury'],
            focus: ['ref:galactic-center'],
            target: ['Venus', 'Earth', 'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Mercury'],
            focus: ['Pluto'],
            target: ['Venus', 'Earth', 'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune'
            ],
        },
        {
            looker: ['Mercury'],
            focus: ['Neptune'],
            target: ['Venus', 'Earth', 'Mars',
                // 'Jupiter', 'Saturn','Uranus'
            ],
        },
        {
            looker: ['Mercury'],
            focus: ['Uranus'],
            target: ['Venus', 'Earth', 'Mars',
                // 'Jupiter', 'Saturn'
            ],
        },
        {
            looker: ['Mercury'],
            focus: ['Saturn'],
            target: ['Venus', 'Earth', 'Mars',
                // 'Jupiter'
            ],
        },
        {
            looker: ['Mercury'],
            focus: ['Jupiter'],
            target: ['Venus', 'Earth', 'Mars'],
        },
        {
            looker: ['Mercury'],
            focus: ['Mars'],
            target: ['Venus',
                // 'Earth'
            ],
        },
        // {
        //     looker: ['Mercury'],
        //     focus: ['Earth'],
        //     target: ['Venus'],
        // },

        // Venus Looker
        {
            looker: ['Venus'],
            focus: ['ref:galactic-center'],
            target: ['Earth', 'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Venus'],
            focus: ['Pluto'],
            target: ['Earth', 'Mars', 'Jupiter',
                // 'Saturn','Uranus','Neptune'
            ],
        },
        {
            looker: ['Venus'],
            focus: ['Neptune'],
            target: ['Earth', 'Mars',
                // 'Jupiter','Saturn','Uranus'
            ],
        },
        {
            looker: ['Venus'],
            focus: ['Uranus'],
            target: ['Earth', 'Mars',
                // 'Jupiter','Saturn'
            ],
        },
        {
            looker: ['Venus'],
            focus: ['Saturn'],
            target: ['Earth', 'Mars', 'Jupiter'],
        },
        {
            looker: ['Venus'],
            focus: ['Jupiter'],
            target: ['Earth', 'Mars'],
        },
        // {
        //     looker: ['Venus'],
        //     focus: ['Mars'],
        //     target: ['Earth'],
        // },

        // Earth Looker
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Moon'],
        },
        {
            looker: ['Earth'],
            focus: ['ref:galactic-center'],
            target: [ 'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Earth'],
            focus: ['Pluto'],
            target: ['Mars',
                // 'Jupiter','Saturn','Uranus','Neptune'
            ],
        },
        {
            looker: ['Earth'],
            focus: ['Neptune'],
            target: ['Mars',
                // 'Jupiter','Saturn','Uranus'
            ],
        },
        {
            looker: ['Earth'],
            focus: ['Uranus'],
            target: ['Mars',
                // 'Jupiter','Saturn'
            ],
        },
        {
            looker: ['Earth'],
            focus: ['Saturn'],
            target: ['Mars',
                // 'Jupiter'
            ],
        },
        {
            looker: ['Earth'],
            focus: ['Jupiter'],
            target: ['Mars'],
        },

        // Mars Looker
        {
            looker: ['Mars'],
            focus: ['ref:galactic-center'],
            target: ['Jupiter',
                // 'Saturn','Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Mars'],
            focus: ['Pluto'],
            target: ['Jupiter',
                // 'Saturn','Uranus','Neptune'
            ],
        },
        {
            looker: ['Mars'],
            focus: ['Neptune'],
            target: ['Jupiter',
                // 'Saturn',// 'Uranus'
            ],
        },
        {
            looker: ['Mars'],
            focus: ['Uranus'],
            target: ['Jupiter',
                // 'Saturn'
            ],
        },
        // {
        //     looker: ['Mars'],
        //     focus: ['Saturn'],
        //     target: ['Jupiter'],
        // },

        // Jupiter Looker
        {
            looker: ['Jupiter'],
            focus: ['ref:galactic-center'],
            target: ['Saturn',
                // 'Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Jupiter'],
            focus: ['Pluto'],
            target: ['Saturn',
                // 'Uranus','Neptune'
            ],
        },
        {
            looker: ['Jupiter'],
            focus: ['Neptune'],
            target: ['Saturn',
                // 'Uranus'
            ],
        },
        // {
        //     looker: ['Jupiter'],
        //     focus: ['Uranus'],
        //     target: ['Saturn'],
        // },

        // Saturn Looker
        {
            looker: ['Saturn'],
            focus: ['ref:galactic-center'],
            target: ['Uranus',
                // 'Neptune',
                'Pluto'],
        },
        // {
        //     looker: ['Saturn'],
        //     focus: ['Pluto'],
        //     target: ['Uranus','Neptune'],
        // },
        {
            looker: ['Saturn'],
            focus: ['Neptune'],
            target: ['Uranus'],
        },

        // Uranus Looker
        {
            looker: ['Uranus'],
            focus: ['ref:galactic-center'],
            target: ['Neptune', 'Pluto'],
        },
        // {
        //     looker: ['Uranus'],
        //     focus: ['Pluto'],
        //     target: ['Neptune'],
        // },

        // Neptune Looker
        {
            looker: ['Neptune'],
            focus: ['ref:galactic-center'],
            target: ['Pluto'],
        },

        // Moon Looker
        // {
        //     looker: ['Moon'],
        //     focus: ['Sun'],
        //     target: ['Earth'],
        // },
        {
            looker: ['Moon'],
            focus: ['ref:galactic-center'],
            target: ['Sun','Mercury', 'Venus', 'Earth', 'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune','Pluto'
            ],
        },
        {
            looker: ['Moon'],
            focus: ['Pluto'],
            target: ['Sun','Mercury', 'Venus',
                // 'Earth',
                'Mars',
                // 'Jupiter','Saturn','Uranus','Neptune'
            ],
        },
        {
            looker: ['Moon'],
            focus: ['Neptune'],
            target: ['Sun','Mercury', 'Venus',
                // 'Earth',
                'Mars',
                // 'Jupiter','Saturn','Uranus'
            ],
        },
        {
            looker: ['Moon'],
            focus: ['Uranus'],
            target: ['Sun','Mercury', 'Venus', 'Earth', 'Mars',
                // 'Jupiter','Saturn'
            ],
        },
        {
            looker: ['Moon'],
            focus: ['Saturn'],
            target: ['Sun','Mercury', 'Venus', 'Earth', 'Mars',
                // 'Jupiter'
            ],
        },
        {
            looker: ['Moon'],
            focus: ['Jupiter'],
            target: ['Sun','Mercury', 'Venus',
                // 'Earth',
                'Mars'],
        },
        {
            looker: ['Moon'],
            focus: ['Mars'],
            target: ['Sun',
                // 'Mercury',
                'Venus', 'Earth'],
        },
    ],
} satisfies Extract<WheelSpec, { type: 'synod' }>;
