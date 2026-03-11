import {REFERENCES, type WheelSpec} from '../types';

export const system = {
    type: 'system',
    ready: true,
    multiTarget: true,
    mainCycle: 'synod',
    houseType: 'synod',
    visuals: {
        primary: 'top',
        secondary: 'side'
    },
    nodes: {
        nodal: ['E-nodal', 'N-nodal', 'W-nodal', 'S-nodal', 'E_next-nodal'],
        bind: ['E-bind', 'N-bind', 'W-bind', 'S-bind', 'E_next-bind'],
        synod: ['E-synod', 'N-synod', 'W-synod', 'S-synod', 'E_next-synod']
    },
    ui: {
        'focus': 'center',
        'looker': 'S',
    },
    requiredRoles: {
        'looker' : ['engine_body', 'reference'],
        'focus' : ['engine_body'],
        'target' : ['engine_body', 'reference'],
    },
    roles: [
        {
            looker: REFERENCES,
            focus: ['Sun'],
            target: [
                // planets:
                'Mercury',
                'Venus',
                'Earth',
                'Mars',
                'Jupiter',
                'Saturn',
                'Uranus',
                'Neptune',
                'Pluto',
                // references:
                ...REFERENCES,
            ]
        },
        {
            looker: ['Sun'],
            focus: ['Earth'],
            target: [
                'Moon',
                // references:
                ...REFERENCES,
            ]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'system' }>;
