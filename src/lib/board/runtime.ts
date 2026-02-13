// src/lib/board/runtime.ts
import type { BodyId } from '../catalog';
import type { Location } from '../location/types';

// Входные роли (target обязателен всегда)
export type WheelRolesInput = {
    looker?: BodyId;     // optional в целом, но конкретное колесо может требовать
    focus?: BodyId;      // optional
    target: BodyId | BodyId[]; // у compass может быть массив, у циклов — 1 элемент (мы проверим)
};

// Контекст времени/локации, который даст host (Board/Cycle/Compass)
export type WheelRuntimeContext = {
    ts: number; // уже effTs (после live/lock логики)
    location?: Location; // если нужно observer
    dbg?: { log?: (...a:any[])=>void; warn?: (...a:any[])=>void; error?: (...a:any[])=>void };
};

// Унифицированный “input в алгоритм”
export type WheelInput = WheelRolesInput & WheelRuntimeContext;

// ====== Выходы ======

export type CycleSpoke<TMeta = any> = {
    ts: number;
    meta: TMeta;
};

// 16 + 1
export type CycleSolveResult<TMeta = any> =
    | { ok: true; kind: 'cycle'; ts: number; spokes: CycleSpoke<TMeta>[] }
    | { ok: false; kind: 'cycle'; ts: number; reason: string; spokes: CycleSpoke<TMeta>[] };

// Compass остаётся отдельным видом результата (не пытаемся “скрестить ежа с компасом”)
export type CompassSolveResult<TBody = any> =
    | { ok: true; kind: 'compass'; ts: number; bodies: TBody[] }
    | { ok: false; kind: 'compass'; ts: number; reason: string; bodies: TBody[] };

export type WheelSolveResult = CycleSolveResult | CompassSolveResult;
