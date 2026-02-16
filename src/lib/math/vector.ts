// src/lib/math/vector.ts

import {isFiniteNumber} from "./helpers";

export function vectorLengthSafe(v: any): number {
    if (!v) return NaN;

    if (typeof v.Length === 'function') {
        const r = v.Length();
        return isFiniteNumber(r) ? r : NaN;
    }

    if (isFiniteNumber(v.length)) {
        return v.length;
    }

    if (isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z)) {
        const r = Math.hypot(v.x, v.y, v.z);
        return isFiniteNumber(r) ? r : NaN;
    }

    return NaN;
}