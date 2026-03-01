// src/lib/wheel/types.ts
export type WheelObserverState = {
    locationId: string;
    locked: boolean;
};

export type WheelTimeState =
    | { live: true; locked: boolean; ts?: never }
    | { live: false; locked: boolean; ts: number };

export type SpokeKey =
    | 'E' | 'ENE' | 'NE' | 'NNE'
    | 'N' | 'NNW' | 'NW' | 'WNW'
    | 'W' | 'WSW' | 'SW' | 'SSW'
    | 'S' | 'SSE' | 'SE' | 'ESE'
    | 'E_next';

export const SPOKES_ORDER: SpokeKey[] = [
    'E', 'ENE', 'NE', 'NNE',
    'N', 'NNW', 'NW', 'WNW',
    'W', 'WSW', 'SW', 'SSW',
    'S', 'SSE', 'SE', 'ESE',
    'E_next',
];

export type MomentTip = {
    label: string;
    ts: number;
    desc?: string;
    pickTsList?: number[];
    tags?: string[];
    metaText?: string;
    metaParts?: string[];
    copyText?: string;
};

export type MarkerItem = {
    id: string;      // instanceId
    baseId: string;
    collectionId: string;

    ts: number;
    angleDeg: number;
    orbit: number;
    bg: string;
    opacity?: number;
    emoji: string;

    title: string;
    description: string;
};

export type MarkerCluster = {
    id: string;         // stable key for {#each}
    ts: number;         // ts used for click default (обычно nearest/first)
    angleDeg: number;   // where to render
    orbit: number;

    bg: string;
    // отображение:
    count: number;
    emoji?: string;     // если count=1
    opacity?: number;
    label?: string;     // если count>1 (например "3")

    // tooltip data:
    items: MarkerItem[];
};
