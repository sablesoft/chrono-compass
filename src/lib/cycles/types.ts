// src/lib/cycles/types.ts - очень мелкий файл. может он нам вообще не нужен? расскидать его по другим подходящим ts файлам?
export const CYCLE_KINDS = ['diurnal', 'lunarSynodic', 'lunarAnomalistic', 'lunarDraconic', 'solarTropical', 'solarAnomalistic', 'plato'] as const;

export type CycleKind = typeof CYCLE_KINDS[number];

export type SpinCmd = {
    id: number;
    dir: 1 | -1;
    // куда приземлиться после полного оборота
    targetAngleDeg: number;
};

export type PreTurnCmd = {
    id: number;
    dir: 1 | -1;
};

export type WheelMarker = {
    id: string;
    ts: number;
    angleDeg: number;
    emoji: string;
    bg: string;
    title: string;
    description: string;
    orbit: number; // 0..1
};

