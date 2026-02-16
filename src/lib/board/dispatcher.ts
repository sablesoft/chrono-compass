// src/lib/board/dispatcher.ts
import type { WheelSolveResult } from './runtime';
import type { BoardWheel } from './types';
import { getWheelEntry } from './registry';

export function solveWheel(
    wheel: BoardWheel,
    ctx: { ts: number; location?: any; dbg?: any }
): WheelSolveResult {
    const entry = getWheelEntry(wheel.wheelType);
    const input = entry.makeInput(wheel, ctx);
    return entry.solve(input as any);
}
