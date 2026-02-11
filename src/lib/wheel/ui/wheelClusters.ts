import {
    computeAngle,
    expandMomentToRange,
    type MarkerCluster,
    type MarkerItem, MAX_INSTANCES_PER_MOMENT, MAX_MARKER_ITEMS_PER_WHEEL,
    momentAllowsCycle,
    type WheelMarkersInput
} from "../wheel";
import {debug} from "../../debug";

const dbg = debug('wheel', '☸️️');
const { warn } = dbg;

function toSignedAngle(a360: number) {
    // Wheel ожидает углы в привычном “-..” стиле тоже ок, но SVG всё равно понимает.
    // Сделаем ближе к [-180..180], чтобы меньше сюрпризов.
    let x = ((a360 + 180) % 360) - 180;
    if (x <= -180) x += 360;
    return x;
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
                warn(`too many marker items in wheel, cutting off`, { kind, count: items.length });
                return items;
            }
        }
    }

    return items;
}
