import type { WheelSpec } from '../types';

export const range = {
    type: 'range',
    requiredRoles: ['looker', 'target'],
    roles: [
        // Sun Range: Moon
        // Distance between Sun and Moon varies cyclically,
        // but they are not directly orbitally bound to each other.
        {
            looker: ['Sun'],
            target: ['Moon']
        },

        // Moon Range: Sun
        // Same physical relation, evaluated from the Moon as looker.
        {
            looker: ['Moon'],
            target: ['Sun']
        }
    ]
} satisfies Extract<WheelSpec, { type: 'range' }>;
