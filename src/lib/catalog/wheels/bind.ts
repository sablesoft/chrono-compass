// src/lib/catalog/wheels/bind.ts
import type { WheelSpec } from '../types';
import { DAY_MS } from '../../math/helpers';

// Notes (practical tuning):
// - For Sun-focus binds, the cycle is essentially the orbital period of the target around the Sun
//   (perihelion->perihelion / aphelion->aphelion windowing as your solver defines it).
// - We tune extrema window/step so that:
//   1) next/prev extrema are very likely inside the search window,
//   2) sampling is not insanely dense for outer planets,
//   3) sanity thresholds stop “tighten-retry” noise for long-period bodies.
//
// “sanity” thresholds are not physics; they are guardrails for:
// - maxCycleMs: E..E_next span that we accept without warnings/retries
// - maxProbeLagMs: how far from ts we accept probes (NProbe/SProbe/etc.) before we consider it suspicious

export const bind = {
    type: 'bind',
    requiredRoles: ['focus', 'target'],
    roles: [
        // ------------------------------------------------------------
        // Sun Bind: Mercury (P ≈ 88 d)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Mercury'],
            meta: {
                extrema: {
                    windowMs: 75 * DAY_MS,
                    stepMs: 6 * 3_600_000, // 6h
                    maxWindowMs: 220 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 200,
                    maxIters: 70,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 120 * DAY_MS,
                    maxProbeLagMs: 110 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Venus (P ≈ 225 d)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Venus'],
            meta: {
                extrema: {
                    windowMs: 190 * DAY_MS,
                    stepMs: 12 * 3_600_000, // 12h
                    maxWindowMs: 700 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 400,
                    maxIters: 70,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 280 * DAY_MS,
                    maxProbeLagMs: 260 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Earth (P ≈ 365 d)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Earth'],
            meta: {
                extrema: {
                    windowMs: 310 * DAY_MS,
                    stepMs: 12 * 3_600_000, // 12h
                    maxWindowMs: 1_200 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 500,
                    maxIters: 70,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 460 * DAY_MS,
                    maxProbeLagMs: 420 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Mars (P ≈ 687 d)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Mars'],
            meta: {
                extrema: {
                    windowMs: 560 * DAY_MS,
                    stepMs: 24 * 3_600_000, // 1d
                    maxWindowMs: 2_400 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 800,
                    maxIters: 70,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 900 * DAY_MS,
                    maxProbeLagMs: 820 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Jupiter (P ≈ 4333 d ~ 11.86 y)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Jupiter'],
            meta: {
                extrema: {
                    windowMs: 3_600 * DAY_MS,
                    stepMs: 5 * DAY_MS,
                    maxWindowMs: 13_500 * DAY_MS,
                    refineIters: 32,
                },
                solve: {
                    epsMs: 5_000,
                    maxIters: 80,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 5_500 * DAY_MS,
                    maxProbeLagMs: 5_000 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Saturn (P ≈ 10759 d ~ 29.46 y)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Saturn'],
            meta: {
                extrema: {
                    windowMs: 9_000 * DAY_MS,
                    stepMs: 10 * DAY_MS,
                    maxWindowMs: 33_000 * DAY_MS,
                    refineIters: 34,
                },
                solve: {
                    epsMs: 12_000,
                    maxIters: 85,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 13_500 * DAY_MS,
                    maxProbeLagMs: 12_000 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Uranus (P ≈ 30687 d ~ 84.0 y)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Uranus'],
            meta: {
                extrema: {
                    windowMs: 26_000 * DAY_MS,
                    stepMs: 20 * DAY_MS,
                    maxWindowMs: 95_000 * DAY_MS,
                    refineIters: 36,
                },
                solve: {
                    epsMs: 30_000,
                    maxIters: 90,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 39_000 * DAY_MS,
                    maxProbeLagMs: 35_000 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Neptune (P ≈ 60190 d ~ 164.8 y)
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Neptune'],
            meta: {
                extrema: {
                    windowMs: 50_000 * DAY_MS,
                    stepMs: 30 * DAY_MS,
                    maxWindowMs: 185_000 * DAY_MS,
                    refineIters: 38,
                },
                solve: {
                    epsMs: 45_000,
                    maxIters: 95,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 75_000 * DAY_MS,
                    maxProbeLagMs: 68_000 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Sun Bind: Pluto (P ≈ 90560 d ~ 248 y) — very long, very eccentric
        // ------------------------------------------------------------
        {
            focus: ['Sun'],
            target: ['Pluto'],
            meta: {
                extrema: {
                    windowMs: 75_000 * DAY_MS,
                    stepMs: 60 * DAY_MS,
                    maxWindowMs: 280_000 * DAY_MS,
                    refineIters: 40,
                },
                solve: {
                    epsMs: 90_000,
                    maxIters: 100,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 120_000 * DAY_MS,
                    maxProbeLagMs: 105_000 * DAY_MS,
                },
            },
        },

        // ------------------------------------------------------------
        // Earth Bind: Moon (anomalistic-ish distance cycle ~ 27.55 d)
        // Key: smaller window + denser step to avoid “wrong” extrema in broad windows.
        // ------------------------------------------------------------
        {
            focus: ['Earth'],
            target: ['Moon'],
            meta: {
                extrema: {
                    windowMs: 60 * DAY_MS,
                    stepMs: 2 * 3_600_000, // 2h
                    maxWindowMs: 240 * DAY_MS,
                    refineIters: 30,
                },
                solve: {
                    epsMs: 200,
                    maxIters: 70,
                    monoEps: 1e-12,
                },
                sanity: {
                    maxCycleMs: 50 * DAY_MS,     // generous vs ~27.6d
                    maxProbeLagMs: 40 * DAY_MS,  // generous vs <= ~27.6d
                },
            },
        },
    ],
} satisfies Extract<WheelSpec, { type: 'bind' }>;