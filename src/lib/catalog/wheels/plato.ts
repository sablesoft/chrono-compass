import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    requiredRoles: ['looker', 'target'],
    roles: []
} satisfies Extract<WheelSpec, { type: 'plato' }>;
