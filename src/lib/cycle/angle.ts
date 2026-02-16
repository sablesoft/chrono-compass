// src/lib/cycle/angle.ts

import type { Anchors } from '../wheel/spokes';
import type { SpokeKey } from '../wheel/types';
import { SPOKES_ORDER } from '../wheel/spokes';
import {clamp} from "../math/helpers";

function segProgress(ts: number, a0: number, a1: number) {
    if (a1 === a0) return 0;
    return clamp((ts - a0) / (a1 - a0), 0, 1);
}

// Base angles for each spoke in clockwise-negative degrees:
// E=0, ENE=-22.5, NE=-45, ... , S=-270, ... , E_next=-360
const STEP_DEG = 360 / 16;

function angleForSpokeIndex(i: number) {
    return -STEP_DEG * i;
}

function hasFinite(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Compute angle using a.spokes if available:
 * - Uses SPOKES_ORDER (length 17): E..E_next
 * - Picks segment by "last spoke time <= ts"
 * - Interpolates within that spoke segment (non-uniform time segments are OK)
 */
function angleFromSpokes(ts: number, a: Anchors) {
    const spokes = a.spokes;
    if (!spokes) return null;

    // Build array of timestamps aligned with SPOKES_ORDER.
    // For endpoints, prefer the canonical anchor fields even if spokes also contain them.
    const times: number[] = SPOKES_ORDER.map((k) => {
        if (k === 'E') return a.E;
        if (k === 'N') return a.N;
        if (k === 'W') return a.W;
        if (k === 'S') return a.S;
        if (k === 'E_next') return a.E_next;

        const v = (spokes as Partial<Record<SpokeKey, number>>)[k];
        return v as number;
    });

    // Need at least E and E_next, and they must be ordered.
    if (!hasFinite(times[0]) || !hasFinite(times[times.length - 1])) return null;
    if (!(times[0] < times[times.length - 1])) return null;

    // If some inner spokes are missing, we *could* fall back,
    // but for safety/consistency: require all to be finite.
    // (Because partial spokes can otherwise create “teleports” in angle.)
    for (let i = 0; i < times.length; i++) {
        if (!hasFinite(times[i])) return null;
    }

    // Ensure monotonic increasing; if not, refuse and fall back to quartile model.
    for (let i = 0; i < times.length - 1; i++) {
        if (!(times[i] < times[i + 1])) return null;
    }

    // Clamp into [E, E_next)
    if (ts <= times[0]) return 0;              // at/before E
    if (ts >= times[times.length - 1]) return -360; // at/after E_next

    // Find segment: last index i where times[i] <= ts
    // (so right after a boundary, we are already in the next segment)
    let i = 0;
    for (let j = 0; j < times.length - 1; j++) {
        if (times[j] <= ts) i = j;
        else break;
    }
    if (i >= times.length - 1) i = times.length - 2;

    const t0 = times[i];
    const t1 = times[i + 1];

    const p = segProgress(ts, t0, t1);
    const a0 = angleForSpokeIndex(i);
    return a0 - STEP_DEG * p;
}

// Универсально fallback: E=0, N=-90, W=-180, S=-270, E_next=-360
export function angleFromAnchors(ts: number, a: Anchors) {
    // 1) Prefer high-resolution spokes if present
    const viaSpokes = angleFromSpokes(ts, a);
    if (viaSpokes !== null) return viaSpokes;

    // 2) Fallback to the old quartile model
    if (ts < a.N) {
        const p = segProgress(ts, a.E, a.N);
        return -90 * p;
    }
    if (ts < a.W) {
        const p = segProgress(ts, a.N, a.W);
        return -90 - 90 * p;
    }
    if (ts < a.S) {
        const p = segProgress(ts, a.W, a.S);
        return -180 - 90 * p;
    }
    const p = segProgress(ts, a.S, a.E_next);
    return -270 - 90 * p;
}
