// src/lib/format.ts
function pad2(n: number) { return String(n).padStart(2, '0'); }
function pad4(n: number) { return String(n).padStart(4, '0'); }

/**
 * JS Date year is astronomical:
 *  1  => 1 AD
 *  0  => 1 BC
 * -1  => 2 BC
 */
function formatYearWithEra(year: number) {
    if (year >= 1) return `${pad4(year)}`; // AD, можно без суффикса
    const bc = 1 - year;                  // 0->1, -1->2, ...
    return `${bc} BC`;
}

export function formatDateTime(ts: number) {
    const d = new Date(ts);

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = d.getHours();
    const mm = d.getMinutes();

    const yStr = formatYearWithEra(y);
    return `${pad2(day)}.${pad2(m)}.${yStr}, ${pad2(hh)}:${pad2(mm)}`;
}

export function formatCoords(lat: number, lon: number) {
    const f = (x: number) => x.toFixed(5);
    return `${f(lat)}, ${f(lon)}`;
}

export function ms(ts: number) {
    return Number.isFinite(ts) ? Math.trunc(ts) : ts; // или Math.round
}