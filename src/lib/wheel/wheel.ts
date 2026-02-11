// src/lib/cycles/wheel.ts
import type {Anchors} from './spokes';
import type {CycleKind} from '../cycles/types';
import type {Moment, OnDayMode, RepeatEnd, RepeatRule, RepeatUnit} from '../stores/moment';
import {normalizeTsMinute} from '../stores/moment';
import {getCycleOptions, SPOKE_DESC} from '../cycles/meta';

import {angleFromDayAnchors, getDayAnchors} from '../cycles/diurnal';
import {angleFromSynodicAnchors, getSynodicAnchors} from '../cycles/lunarSynodic';
import {angleFromDraconicAnchors, getDraconicAnchors} from "../cycles/lunarDraconic";
import {angleFromLunarAnomalisticAnchors, getLunarAnomalisticAnchors} from "../cycles/lunarAnomalistic";
import {angleFromTropicalAnchors, getTropicalAnchors} from '../cycles/solarTropical';
import {angleFromSolarAnomalisticAnchors, getSolarAnomalisticAnchors} from '../cycles/solarAnomalistic';
import {angleFromPlatoAnchors, getPlatoAnchors} from '../cycles/plato';
import {debug} from '../debug';

const dbg = debug('wheel', '☸️️');
const { warn } = dbg;

export type MomentTip = {
    label: string;
    ts: number;
    desc?: string;
};

export const SPOKES = 16;
export const SHIFT_EPS_MS = 60_000;

// Сколько occurrences максимум разворачиваем на 1 базовый moment в пределах текущего колеса.
// Если перебор — просто не рисуем этот moment на колесе (лучше чем убить UI).
export const MAX_INSTANCES_PER_MOMENT = 128;

// Сколько вообще marker items допустим в одном колесе (после разворота).
// Это защита от "много моментов * много коллекций".
export const MAX_MARKER_ITEMS_PER_WHEEL = 4096;

export type MomentInstance = {
    instanceId: string; // уникальный id (baseId:ts)
    baseId: string;     // id базового Moment
    ts: number;         // occurrence time (ms, normalized)
    title: string;
    description?: string;
    emoji?: string;
    collectionId: string;
    repeatIndex: number; // 0 = базовый, 1..N = repeat
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


const NUDGE_MS = 5 * 60_000; // 5 минут (можно 1 мин, но 5 устойчивее)

function clamp(x: number, a: number, b: number) {
    return Math.max(a, Math.min(b, x));
}


export function sameCycle(a: Anchors, b: Anchors) {
    // сравнение с допуском, чтобы не плясало из-за миллисекунд
    const eps = 2_000; // 2s
    return Math.abs(a.E - b.E) <= eps && Math.abs(a.E_next - b.E_next) <= eps;
}

export function nudgeInsideCycle(ts: number, a: Anchors, dir: -1 | 1) {
    // цикл у тебя по смыслу [E, E_next)
    const lo = a.E + SHIFT_EPS_MS;
    const hi = a.E_next - SHIFT_EPS_MS;

    // если попали ровно в “опасные” точки — уводим внутрь
    if (ts === a.E)      ts = a.E + NUDGE_MS;
    if (ts === a.E_next) ts = a.E_next - NUDGE_MS;

    if (ts === a.N) ts = a.N + (dir > 0 ? NUDGE_MS : -NUDGE_MS);
    if (ts === a.W) ts = a.W + (dir > 0 ? NUDGE_MS : -NUDGE_MS);
    if (ts === a.S) ts = a.S + (dir > 0 ? NUDGE_MS : -NUDGE_MS);

    return clamp(ts, lo, hi);
}

export function computeAnchors(kind: CycleKind, ts: number, lat: number, lon: number): Anchors {
    if (kind === 'lunarSynodic') return getSynodicAnchors(ts);
    if (kind === 'lunarAnomalistic') return getLunarAnomalisticAnchors(ts);
    if (kind === 'lunarDraconic') return getDraconicAnchors(ts);
    if (kind === 'solarTropical') return getTropicalAnchors(ts, lat, lon);
    if (kind === 'solarAnomalistic') return getSolarAnomalisticAnchors(ts);
    if (kind === 'plato') return getPlatoAnchors(ts);
    return getDayAnchors(ts, lat, lon);
}

export function computeAngle(kind: CycleKind, ts: number, a: Anchors): number {
    if (kind === 'lunarSynodic') return angleFromSynodicAnchors(ts, a);
    if (kind === 'lunarAnomalistic') return angleFromLunarAnomalisticAnchors(ts, a);
    if (kind === 'lunarDraconic') return angleFromDraconicAnchors(ts, a);
    if (kind === 'solarTropical') return angleFromTropicalAnchors(ts, a);
    if (kind === 'solarAnomalistic') return angleFromSolarAnomalisticAnchors(ts, a);
    if (kind === 'plato') return angleFromPlatoAnchors(ts, a);
    return angleFromDayAnchors(ts, a);
}
export type MomentClickHandlers = {
    onSingle: (e: MouseEvent) => void;
    onDouble: (e: MouseEvent) => void;
    delay?: number;
};

export function createMomentClickHandler({
  onSingle,
  onDouble,
  delay = 600,
}: MomentClickHandlers) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function clear() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }
    function onClick(e: MouseEvent) {
        if (timer) return;

        timer = setTimeout(() => {
            onSingle(e);
            timer = null;
        }, delay);
    }
    function onDblClick(e: MouseEvent) {
        e.preventDefault();
        clear();
        onDouble(e);
    }

    return {
        onClick,
        onDblClick,
    };
}

// Для 16 спиц: E, ENE, ..., ESE
export function buildSpokeTip(
    kind: CycleKind,
    spokeLabel: string,
    ts: number
): MomentTip {
    let result;
    const desc = SPOKE_DESC[kind][spokeLabel as keyof typeof SPOKE_DESC[typeof kind]];
    let label = spokeLabel == 'E_next' ? 'E+' : spokeLabel;
    if (desc) {
        result = {
            label: `${label} — ${desc}`,
            ts,
            desc: undefined
        };
    } else {
        result = {
            label: label,
            ts,
            desc: undefined
        };
    }

    return result;
}

// Граница: "E-ENE Boundary"
export function buildBoundaryTip(a: string, b: string, ts: number): MomentTip {
    return {label: `${a}-${b} Boundary`, ts, desc: undefined};
}

export function buildHouseBoundaries(spokes: number[]): number[] {
    const n = spokes.length;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        const cur = spokes[i];
        const next = spokes[(i + 1) % n];
        out.push(Math.round((cur + next) / 2));
    }
    return out;
}

export function momentAllowsCycle(m: Moment, cycle: CycleKind): boolean {
    const list = (m as any).cycles as CycleKind[] | undefined;
    const eff = (Array.isArray(list) && list.length) ? list : defaultMomentCycles();
    return eff.includes(cycle);
}

function defaultMomentCycles(): CycleKind[] {
    const opts = getCycleOptions().filter(o => !o.disabled).map(o => o.kind);
    if (opts.length <= 1) return opts;
    // всё кроме “самого большого” (сейчас это plato)
    return opts.slice(0, -1);
}

function lastDayOfMonth(y: number, m0: number) {
    return new Date(y, m0 + 1, 0).getDate();
}

function clampDay(y: number, m0: number, day: number) {
    return Math.min(day, lastDayOfMonth(y, m0));
}

function addMonthsWithOnDay(base: Date, months: number, onDay: OnDayMode, keepDay: number) {
    const t = new Date(base);
    t.setSeconds(0, 0);

    t.setDate(1);
    t.setMonth(t.getMonth() + months);

    const y = t.getFullYear();
    const m0 = t.getMonth();

    const day =
        onDay === 'last'
            ? lastDayOfMonth(y, m0)
            : onDay === 'clamp'
                ? clampDay(y, m0, keepDay)
                : keepDay;

    t.setDate(day);
    t.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return t;
}

function addYearsWithOnDay(base: Date, years: number, onDay: OnDayMode, keepMonth: number, keepDay: number) {
    const t = new Date(base);
    t.setSeconds(0, 0);

    t.setFullYear(base.getFullYear() + years, keepMonth, 1);

    const y = t.getFullYear();
    const m0 = t.getMonth();

    const day =
        onDay === 'last'
            ? lastDayOfMonth(y, m0)
            : onDay === 'clamp'
                ? clampDay(y, m0, keepDay)
                : keepDay;

    t.setDate(day);
    t.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return t;
}

function addFixed(baseTs: number, unit: RepeatUnit, step: number) {
    switch (unit) {
        case 'minute': return baseTs + step * 60_000;
        case 'hour':   return baseTs + step * 3_600_000;
        case 'day':    return baseTs + step * 86_400_000;
        case 'week':   return baseTs + step * 7 * 86_400_000;
        default:       return baseTs;
    }
}

function normalizeRange(start: number, end: number) {
    return { start: normalizeTsMinute(start), end: normalizeTsMinute(end) };
}

function isRepeatEnabled(r?: RepeatRule) {
    return !!r && Number.isFinite(r.every) && (r.every as number) > 0;
}

function endAllows(end: RepeatEnd, k: number, occTs: number) {
    if (!end || end.mode === 'never') return true;
    if (end.mode === 'count') return k < Math.max(1, end.count);
    if (end.mode === 'until') return occTs <= end.untilTs;
    return true;
}

function unitLabel(u: RepeatUnit) {
    switch (u) {
        case 'year': return 'year';
        case 'month': return 'month';
        case 'week': return 'week';
        case 'day': return 'day';
        case 'hour': return 'hour';
        case 'minute': return 'minute';
    }
}

function pluralize(base: string, n: number) {
    return n === 1 ? base : `${base}s`;
}

function repeatSuffix(m: Moment, idx: number) {
    const r = m.repeat;
    if (!r) return `(${idx})`;

    const every = Math.max(1, r.every ?? 1);
    const base = unitLabel(r.unit);
    const unit = pluralize(base, every);

    const n = idx * every;
    return `(${n} ${unit})`;
}

/**
 * Разворачивает базовый moment в occurrences, которые попадают в [start..end)
 * Без генерации всего будущего — только то, что нужно для текущего колеса.
 */
export function expandMomentToRange(
    m: Moment,
    start0: number,
    end0: number,
    limits: { maxInstancesPerMoment?: number } = {}
): MomentInstance[] {
    const maxPerMoment = limits.maxInstancesPerMoment ?? MAX_INSTANCES_PER_MOMENT;

    const { start, end } = normalizeRange(start0, end0);
    const out: MomentInstance[] = [];

    const baseTs = normalizeTsMinute(m.ts);
    const r = m.repeat;

    if (!isRepeatEnabled(r)) {
        if (baseTs >= start && baseTs < end) {
            out.push({
                instanceId: m.id,
                baseId: m.id,
                ts: baseTs,
                title: m.title,
                description: m.description,
                emoji: m.emoji,
                collectionId: m.collectionId,
                repeatIndex: 0
            });
        }
        return out;
    }

    const every = Math.max(1, Math.min(999, r!.every));
    const unit = r!.unit;
    const onDay = r!.onDay ?? 'same';
    const endRule = r!.end ?? { mode: 'never' as const };

    const baseDate = new Date(baseTs);
    const keepDay = baseDate.getDate();
    const keepMonth = baseDate.getMonth();

    const occTs = (k: number) => {
        if (k === 0) return baseTs;
        if (unit === 'month') return addMonthsWithOnDay(baseDate, k * every, onDay, keepDay).getTime();
        if (unit === 'year')  return addYearsWithOnDay(baseDate, k * every, onDay, keepMonth, keepDay).getTime();
        return addFixed(baseTs, unit, k * every);
    };

    // 1) Найти первый k, который попадает в окно
    let k = 0;
    let guard = 0;

    while (true) {
        const t = normalizeTsMinute(occTs(k));
        if (!endAllows(endRule, k, t)) return out;

        if (t >= start) break;

        k++;
        guard++;

        if (guard > maxPerMoment) {
            warn(`skip markers: too many repeats before range`, { id: m.id, unit, every, guard });
            return [];
        }
    }

    // 2) Собрать occurrences в окне
    for (let idx = k; idx < 200000; idx++) {
        const t = normalizeTsMinute(occTs(idx));
        if (!endAllows(endRule, idx, t)) break;
        if (t >= end) break;

        out.push({
            instanceId: `${m.id}:${t}`,
            baseId: m.id,
            ts: t,
            title: idx === 0 ? m.title : `${m.title} ${repeatSuffix(m, idx)}`,
            description: m.description,
            emoji: m.emoji,
            collectionId: m.collectionId,
            repeatIndex: idx
        });

        if (out.length > maxPerMoment) {
            warn(`skip markers: too many repeats in range`, { id: m.id, unit, every, count: out.length });
            return [];
        }
    }

    return out;
}

export type CollectionStyle = {
    markerBg?: string;
    orbit?: number;
};

export type WheelMarkersInput = {
    kind: CycleKind;
    anchors: Anchors;
    lat: number;
    lon: number;

    moments: Moment[];
    visibleCollectionIds: string[];
    collectionById: Map<string, CollectionStyle>;
};

export function isFiniteNumber(x: number) {
    return Number.isFinite(x) && !Number.isNaN(x);
}

export function safeDateFromTs(ts: number): Date | null {
    if (!isFiniteNumber(ts)) return null;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function utcYearFromTs(ts: number): number | null {
    const d = safeDateFromTs(ts);
    if (!d) return null;
    const y = d.getUTCFullYear();
    return Number.isNaN(y) ? null : y;
}