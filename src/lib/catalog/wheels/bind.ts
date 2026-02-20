// src/lib/catalog/wheels/bind.ts
import type { WheelSpec } from '../types';
import { DAY_MS } from '../../math/helpers';

export const bind = {
    type: 'bind',
    ready: true,
    ui: {
        focus: 'center',
        target: 'pointer',
    },
    requiredRoles: {
        'focus' : ['engine_body'],
        'target': ['engine_body']
    },
    roles: [
        // Sun Bind: Mercury (sidereal ≈ 87.9691 d)
        {
            focus: ['Sun'],
            target: ['Mercury'],
            meta: {
                cycleDuration: 87.9691 * DAY_MS,
            },
        },

        // Sun Bind: Venus (sidereal ≈ 224.701 d)
        {
            focus: ['Sun'],
            target: ['Venus'],
            meta: {
                cycleDuration: 224.701 * DAY_MS,
            },
        },

        // Sun Bind: Earth (sidereal ≈ 365.25636 d)
        {
            focus: ['Sun'],
            target: ['Earth'],
            meta: {
                cycleDuration: 365.25636 * DAY_MS,
            },
        },

        // Sun Bind: Mars (sidereal ≈ 686.971 d)
        {
            focus: ['Sun'],
            target: ['Mars'],
            meta: {
                cycleDuration: 686.971 * DAY_MS,
            },
        },

        // Sun Bind: Jupiter (sidereal ≈ 4332.589 d)
        {
            focus: ['Sun'],
            target: ['Jupiter'],
            meta: {
                cycleDuration: 4332.589 * DAY_MS,
            },
        },

        // Sun Bind: Saturn (sidereal ≈ 10759.22 d)
        {
            focus: ['Sun'],
            target: ['Saturn'],
            meta: {
                cycleDuration: 10759.22 * DAY_MS,
            },
        },

        // Sun Bind: Uranus (sidereal ≈ 30688.5 d)
        {
            focus: ['Sun'],
            target: ['Uranus'],
            meta: {
                cycleDuration: 30688.5 * DAY_MS,
            },
        },

        // Sun Bind: Neptune (sidereal ≈ 60182 d)
        {
            focus: ['Sun'],
            target: ['Neptune'],
            meta: {
                cycleDuration: 60182 * DAY_MS,
            },
        },

        // Sun Bind: Pluto (sidereal ≈ 90560 d)
        {
            focus: ['Sun'],
            target: ['Pluto'],
            meta: {
                cycleDuration: 90560 * DAY_MS,
            },
        },

        // Earth Bind: Moon (anomalistic month ≈ 27.55455 d)
        {
            focus: ['Earth'],
            target: ['Moon'],
            meta: {
                cycleDuration: 27.55455 * DAY_MS,
            },
        },
    ],
} satisfies Extract<WheelSpec, { type: 'bind' }>;