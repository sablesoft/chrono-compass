// src/lib/cycles/wheel.ts
import type { Anchors } from './spokes';
import type { CycleKind } from './types';
import type { Moment, RepeatRule, RepeatUnit, OnDayMode, RepeatEnd } from '../stores/moment';
import { normalizeTsMinute } from '../stores/moment';
import { ms } from '../format';
import { getCycleOptions } from './meta';

import { getDayAnchors, angleFromDayAnchors } from './day';
import { getMoonAnchors, angleFromMoonAnchors } from './moon';
import { getYearAnchors, angleFromYearAnchors } from './year';
import { getPlatoAnchors, angleFromPlatoAnchors } from './plato';

export const SPOKES = 16;
export const SHIFT_EPS_MS = 1;

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
    label?: string;     // если count>1 (например "3")

    // tooltip data:
    items: MarkerItem[];
};

export function computeAnchors(kind: CycleKind, ts: number, lat: number, lon: number): Anchors {
    if (kind === 'moon') return getMoonAnchors(ts);
    if (kind === 'year') return getYearAnchors(ts, lat, lon);
    if (kind === 'plato') return getPlatoAnchors(ts);
    return getDayAnchors(ts, lat, lon);
}

export function computeAngle(kind: CycleKind, ts: number, a: Anchors): number {
    if (kind === 'moon') return angleFromMoonAnchors(ts, a);
    if (kind === 'year') return angleFromYearAnchors(ts, a);
    if (kind === 'plato') return angleFromPlatoAnchors(ts, a);
    return angleFromDayAnchors(ts, a);
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
            console.warn(`skip markers: too many repeats before range`, { id: m.id, unit, every, guard });
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
            console.warn(`skip markers: too many repeats in range`, { id: m.id, unit, every, count: out.length });
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

export function buildMarkerItemsForWheel(input: WheelMarkersInput): MarkerItem[] {
    const { kind, anchors, moments, visibleCollectionIds, collectionById } = input;

    const visible = new Set(visibleCollectionIds);
    const items: MarkerItem[] = [];

    for (const m of moments) {
        if (!visible.has(m.collectionId)) continue;
        if (!momentAllowsCycle(m, kind)) continue;

        const inst = expandMomentToRange(m, anchors.start, anchors.end, {
            maxInstancesPerMoment: MAX_INSTANCES_PER_MOMENT
        });

        for (const mi of inst) {
            const col = collectionById.get(mi.collectionId);
            items.push({
                id: mi.instanceId,
                baseId: mi.baseId,
                collectionId: mi.collectionId,

                ts: mi.ts,
                angleDeg: computeAngle(kind, mi.ts, anchors),
                emoji: mi.emoji || '📍',
                bg: col?.markerBg ?? 'var(--accent-live)',
                orbit: col?.orbit ?? 0.9,

                title: mi.title,
                description: mi.description ?? ''
            });

            if (items.length > MAX_MARKER_ITEMS_PER_WHEEL) {
                console.warn(`too many marker items in wheel, cutting off`, { kind, count: items.length });
                return items;
            }
        }
    }

    return items;
}

/**
 * Кластеризация маркеров: если на одной орбите они слишком близко — объединяем.
 * minArcPx = минимальная дуга в пикселях, при меньшей — слипается.
 *
 * getRadiusPx: (orbit)-> радиус в пикселях для конкретного маркера (зависит от Wheel геометрии)
 */
export function clusterMarkerItems(
    items: MarkerItem[],
    getRadiusPx: (orbit: number) => number,
    minArcPx: number
): MarkerCluster[] {
    if (!items.length) return [];

    // группируем по "почти одинаковой" орбите
    const ORBIT_EPS = 1e-4;

    const sorted = items
        .slice()
        .sort((a, b) => (a.orbit - b.orbit) || (a.angleDeg - b.angleDeg) || (a.ts - b.ts));

    const groups: MarkerItem[][] = [];
    let cur: MarkerItem[] = [];

    const flush = () => {
        if (cur.length) groups.push(cur);
        cur = [];
    };

    for (const it of sorted) {
        if (!cur.length) {
            cur.push(it);
            continue;
        }
        const prev = cur[cur.length - 1];
        if (Math.abs(prev.orbit - it.orbit) <= ORBIT_EPS) {
            cur.push(it);
        } else {
            flush();
            cur.push(it);
        }
    }
    flush();

    // теперь внутри каждой орбиты — кластер по углу
    const out: MarkerCluster[] = [];

    for (const sameOrbit of groups) {
        const orbit = sameOrbit[0].orbit;
        const r = Math.max(1, getRadiusPx(orbit));
        const epsDeg = (minArcPx / r) * (180 / Math.PI); // arc ~ r*rad

        // углы нужно нормализовать в [0..360) для корректной "сшивки" вокруг 0
        const norm = (a: number) => {
            let x = a % 360;
            if (x < 0) x += 360;
            return x;
        };

        const list = sameOrbit
            .map(it => ({ it, a: norm(it.angleDeg) }))
            .sort((x, y) => x.a - y.a);

        // первичная линейная кластеризация по соседям
        const clusters: { items: MarkerItem[]; aSum: number; aFirst: number; aLast: number }[] = [];
        let c: { items: MarkerItem[]; aSum: number; aFirst: number; aLast: number } | null = null;

        for (const x of list) {
            if (!c) {
                c = { items: [x.it], aSum: x.a, aFirst: x.a, aLast: x.a };
                continue;
            }
            const da = x.a - c.aLast;
            if (da <= epsDeg) {
                c.items.push(x.it);
                c.aSum += x.a;
                c.aLast = x.a;
            } else {
                clusters.push(c);
                c = { items: [x.it], aSum: x.a, aFirst: x.a, aLast: x.a };
            }
        }
        if (c) clusters.push(c);

        // “склейка” первого и последнего, если близко через 360
        if (clusters.length >= 2) {
            const first = clusters[0];
            const last = clusters[clusters.length - 1];
            const wrapGap = (first.aFirst + 360) - last.aLast;
            if (wrapGap <= epsDeg) {
                // переносим углы first как +360, чтобы среднее не уползло
                const moved = first.items;
                const movedSum = first.items.reduce((sum, it) => sum + (norm(it.angleDeg) + 360), 0);

                last.items.push(...moved);
                last.aSum += movedSum;
                // обновим last.aLast как “тот же”, но теперь диапазон расширился
                last.aLast = first.aLast + 360;

                clusters.shift();
            }
        }

        // финализация в MarkerCluster[]
        for (const cc of clusters) {
            const count = cc.items.length;
            const aAvg = cc.aSum / count;
            const aRender = ((aAvg % 360) + 360) % 360;

            // берём "основной" item: ближайший по времени к среднему? пока просто первый по ts
            const itemsSortedByTs = cc.items.slice().sort((a, b) => a.ts - b.ts);
            const head = itemsSortedByTs[0];

            const id =
                count === 1
                    ? head.id
                    : `cluster:${head.collectionId}:${orbit}:${Math.round(aRender * 10)}:${count}`;

            out.push({
                id,
                ts: head.ts,
                angleDeg: toSignedAngle(aRender),
                orbit,
                bg: head.bg,
                count,
                emoji: count === 1 ? head.emoji : undefined,
                label: count > 1 ? String(count) : undefined,
                items: itemsSortedByTs
            });
        }
    }

    return out;
}

function toSignedAngle(a360: number) {
    // Wheel ожидает углы в привычном “-..” стиле тоже ок, но SVG всё равно понимает.
    // Сделаем ближе к [-180..180], чтобы меньше сюрпризов.
    let x = ((a360 + 180) % 360) - 180;
    if (x <= -180) x += 360;
    return x;
}