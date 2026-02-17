// src/lib/board/runtime.ts
import type { BodyId } from '../catalog';
import type { Location } from '../location/types';
import type { SpokeKey } from "../wheel/types";
import type { WheelType, WheelMeta } from '../catalog';

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

// Вариант “нормальный”: meta типизирован по wheelType (но wheelType должен быть в input)
export type WheelInput<TType extends WheelType = WheelType> =
    WheelRolesInput &
    WheelRuntimeContext & {
    wheelType: TType;
    meta?: WheelMeta<TType>;
};

// ====== outputs ======
export type CycleSpoke<TMeta = any> = {
    ts: number;
    code: SpokeKey;
    index: number;
    meta: TMeta;
};

// 16 + 1
export type CycleSolveResult<TMeta = any> =
    | { ok: true; kind: 'cycle'; ts: number; spokes: CycleSpoke<TMeta>[] }
    | { ok: false; kind: 'cycle'; ts: number; reason: string; spokes: CycleSpoke<TMeta>[] };

// Compass - отдельный вид результата
export type CompassSolveResult<TBody = any> =
    | { ok: true; kind: 'compass'; ts: number; bodies: TBody[] }
    | { ok: false; kind: 'compass'; ts: number; reason: string; bodies: TBody[] };

export type WheelSolveResult = CycleSolveResult | CompassSolveResult;
