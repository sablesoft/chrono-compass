// src/lib/location/types.ts
export type Location = {
    lat: number;
    lon: number;
    label: string;

    tz: string; // IANA timezone, always defined
};

export type SavedLocation = Location & {
    id: string;
    createdAt: number;
    updatedAt: number;
};

export type GeoStatus =
    | 'idle'
    | 'loading'
    | 'ok'
    | 'denied'
    | 'unavailable'
    | 'error';

export type LocationData = {
    current: Location;
    saved: SavedLocation[];
};
