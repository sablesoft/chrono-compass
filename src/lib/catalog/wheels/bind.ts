// src/lib/catalog/wheels/bind.ts
import type { WheelSpec } from '../types';
import {DAY_MS} from "../../math/helpers";

export const bind = {
    type: 'bind',
    requiredRoles: ['focus', 'target'],
    roles: [
        // Sun Bind: Earth
        {
            focus: ['Sun'],
            target: ['Earth'],
            // meta - defaults
        },
        // Earth Bind: Moon
        {
            focus: ['Earth'],
            target: ['Moon'],
            meta: {
                extrema: {
                    windowMs: 60 * DAY_MS,          // ключевое: меньше
                    stepMs: 2 * 3_600_000,        // ключевое: плотнее
                    maxWindowMs: 240 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 200,                  // можно чуть жестче
                    maxIters: 70,
                    monoEps: 1e-12,
                }
            }
        }
    ]
} satisfies Extract<WheelSpec, { type: 'bind' }>;