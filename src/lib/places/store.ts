export type Place = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    createdAt: number;
};

const KEY = 'wheels.places.v1';

function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadPlaces(): Place[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as Place[];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function savePlaces(places: Place[]) {
    localStorage.setItem(KEY, JSON.stringify(places));
}

export function addPlace(name: string, lat: number, lon: number) {
    const places = loadPlaces();
    const p: Place = { id: uid(), name, lat, lon, createdAt: Date.now() };
    places.unshift(p);
    savePlaces(places);
    return p;
}

export function removePlace(id: string) {
    const places = loadPlaces().filter(p => p.id !== id);
    savePlaces(places);
    return places;
}