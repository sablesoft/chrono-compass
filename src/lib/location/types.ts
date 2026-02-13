// src/lib/location/types.ts
export type Location = {
    id: string;

    lat: number;
    lon: number;
    label: string;

    tz: string; // IANA timezone, always defined
};

export type GeoStatus =
    | 'idle'
    | 'loading'
    | 'ok'
    | 'denied'
    | 'unavailable'
    | 'error';

export type LocationData = {
    currentId: string;   // ALWAYS points to saved[].id (after init)
    saved: Location[];
};
