import type { WheelSpec } from '../types';

export const compass = {
    type: 'compass',
    ready: true,
    multiTarget: true,
    mainCycle: 'horizon',
    houseType: 'compass',
    nodes: {
        horizon: ['E-horizon',  'NE-horizon', 'N-horizon',  'NW-horizon', 'W-horizon',  'SW-horizon', 'S-horizon',  'SE-horizon', 'E_next-horizon',],
        compass: ['E-compass', 'NE-compass', 'N-compass', 'NW-compass', 'W-compass', 'SW-compass', 'S-compass', 'SE-compass',]
    },
    requiredRoles: {
        'looker' : ['engine_body'],
        'target' : ['engine_body', 'reference']
    },
    roles: [
        // Earth Compass: Sky (targets are selectable)
        {
            looker: ['Earth'],
            target: [
                'Sun',
                'Moon',
                'Mercury',
                'Venus',
                'Mars',
                'Jupiter',
                'Neptune',
                'Pluto',
                'Saturn',
                'Uranus',
                // orientations:
                'ref:galactic-center',

                // stars:
                'ref:sirius',
                'ref:polaris',
                'ref:betelgeuse',
                'ref:antares',
                'ref:deneb',
                'ref:altair',
                'ref:nunki',
            ]
        }
    ]
} satisfies Extract<WheelSpec, { type: 'compass' }>;
