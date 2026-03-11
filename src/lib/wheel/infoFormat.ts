import { formatDateTime } from '../format';

export type FormatInput = number | string | null | undefined;
const AU_PER_LY = 63_241.077;
const LY_PER_PC = 3.26156;
const AU_PER_PC = AU_PER_LY * LY_PER_PC;

function toNum(v: FormatInput): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatDate(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${pad2(day)}.${pad2(m)}.${y}`;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    const hh = d.getHours();
    const mm = d.getMinutes();
    return `${pad2(hh)}:${pad2(mm)}`;
}

function formatNum(n: number, dp: number): string {
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(dp);
}

function formatKm(n: number): string {
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(3)} Tkm`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(3)} Bkm`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(3)} Mkm`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(3)} Kkm`;
    return `${n.toFixed(3)} km`;
}

function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const totalMinutes = Math.floor(ms / 60_000);
    if (totalMinutes <= 0) return '0m';
    let minutes = totalMinutes;
    const MIN_PER_HOUR = 60;
    const MIN_PER_DAY = 24 * MIN_PER_HOUR;
    const MIN_PER_MONTH = 30 * MIN_PER_DAY;
    const MIN_PER_YEAR = 365 * MIN_PER_DAY;
    const years = Math.floor(minutes / MIN_PER_YEAR); minutes -= years * MIN_PER_YEAR;
    const months = Math.floor(minutes / MIN_PER_MONTH); minutes -= months * MIN_PER_MONTH;
    const days = Math.floor(minutes / MIN_PER_DAY); minutes -= days * MIN_PER_DAY;
    const hours = Math.floor(minutes / MIN_PER_HOUR); minutes -= hours * MIN_PER_HOUR;
    const mins = minutes;
    const parts: string[] = [];
    if (years) parts.push(`${years}y`);
    if (months) parts.push(`${months}mo`);
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (mins) parts.push(`${mins}m`);
    return parts.length ? parts.join(' ') : '0m';
}

export function formatInfoValue(format: string | undefined, raw: FormatInput): string {
    if (!format) return raw == null ? '—' : String(raw);
    const n = toNum(raw);
    switch (format) {
        case 'dateTime':
            return Number.isFinite(n) ? formatDateTime(n) : '—';
        case 'date':
            return Number.isFinite(n) ? formatDate(n) : '—';
        case 'time':
            return Number.isFinite(n) ? formatTime(n) : '—';
        case 'deg':
            return formatNum(n, 1);
        case 'deg2':
            return formatNum(n, 2);
        case 'au':
            return formatNum(n, 6);
        case 'pc':
            return Number.isFinite(n) ? formatNum(n / AU_PER_PC, 3) : '—';
        case 'ly':
            return Number.isFinite(n) ? formatNum(n / AU_PER_LY, 3) : '—';
        case 'km':
            return formatKm(n);
        case 'duration':
            return Number.isFinite(n) ? formatDuration(n) : '—';
        default:
            return raw == null ? '—' : String(raw);
    }
}
