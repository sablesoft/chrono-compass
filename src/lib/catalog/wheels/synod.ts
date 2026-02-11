import type { WheelSpec } from '../types';

export const synod = {
    type: 'synod',
    roles: [
        // Earth Synod: Sun - Moon (classic synodic relation as seen from Earth)
        {
            looker: ['Earth'],
            focus: ['Sun'],
            target: ['Moon']
        },

        // Moon Synod: Sun - Earth (Earth phases as seen from the Moon)
        {
            looker: ['Moon'],
            focus: ['Sun'],
            target: ['Earth']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'synod' }>;
