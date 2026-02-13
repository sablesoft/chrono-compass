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