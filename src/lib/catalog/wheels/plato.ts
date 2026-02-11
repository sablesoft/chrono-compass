import type { WheelSpec } from '../types';

export const plato = {
    type: 'plato',
    roles: []
} satisfies Extract<WheelSpec, { type: 'plato' }>;
