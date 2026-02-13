// src/lib/cycles/bind.ts
import type { WheelInput, CycleSolveResult } from '../board/runtime';

// meta для bind (пока минимум)
export type BindMeta = {
    distanceAu?: number;
};

export function solveBindWheel(input: WheelInput): CycleSolveResult<BindMeta> {
    // валидация ролей (жёстко)
    if (!input.focus) {
        return { ok: false, kind: 'cycle', ts: input.ts, reason: 'Bind wheel requires focus', spokes: [] };
    }
    if (!input.target || Array.isArray(input.target)) {
        return { ok: false, kind: 'cycle', ts: input.ts, reason: 'Bind wheel requires single target', spokes: [] };
    }

    // TODO: тут будет реальный расчёт 16+1 spoke
    // Сейчас — минимальная заглушка, чтобы собрать все слои и UI
    const spokes = Array.from({ length: 17 }, (_, i) => ({
        ts: input.ts + i * 60_000, // временно
        meta: {}
    }));

    return { ok: true, kind: 'cycle', ts: input.ts, spokes };
}