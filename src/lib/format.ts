export function formatDateTime(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatCoords(lat: number, lon: number) {
    const f = (x: number) => x.toFixed(5);
    return `${f(lat)}, ${f(lon)}`;
}