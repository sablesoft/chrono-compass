// src/lib/cycles/types.ts - очень мелкий файл. может он нам вообще не нужен? расскидать его по другим подходящим ts файлам?
export const CYCLE_KINDS = ['diurnal', 'lunarSynodic', 'lunarAnomalistic', 'lunarDraconic', 'solarTropical', 'solarAnomalistic', 'plato'] as const;

export type CycleKind = typeof CYCLE_KINDS[number];

