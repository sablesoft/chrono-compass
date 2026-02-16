// src/lib/cycle/types.ts

import type { CycleSpoke } from '../board/runtime';

/**
 * Types that we currently do NOT persist in client storage.
 * (Local in-memory cache can still be used by Cycle.svelte if you want.)
 */
export const CYCLE_PERSIST_EXCLUDED_TYPES = new Set<string>(['compass', 'horizon']);

/**
 * Canonical cache key for a cycle configuration.
 * Format: "<wheelType>:<looker>:<focus>:<target>"
 *
 * Important: do NOT reorder parts — this is the contract.
 */
export type CycleKey = string & { readonly __cycleKey: unique symbol };

export type CycleData<Meta = any> = {
    key: CycleKey;

    /** Inclusive cycle window start (E) */
    startTs: number;

    /** Inclusive cycle window end (E_next / E+) */
    endTs: number;

    /** 17 spokes: indices 0..16 */
    spokes: CycleSpoke<Meta>[];

    /** For eviction / debugging */
    createdAt: number;
    updatedAt: number;
};
