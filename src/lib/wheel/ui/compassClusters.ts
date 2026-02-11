// src/lib/wheel/clusterByOverlap.ts
import type { MarkerItem, MarkerCluster } from '../wheel';

function norm360(deg: number): number {
    let x = deg % 360;
    if (x < 0) x += 360;
    return x;
}

function toSignedAngle(deg0_360: number): number {
    let a = norm360(deg0_360);
    if (a > 180) a -= 360;
    return a;
}

export function compassClusters(
    items: MarkerItem[],
    getRadiusPx: (orbit: number) => number,
    markerRadiusPx: number
): MarkerCluster[] {
    if (!items.length) return [];

    // overlap>1/3 => dist < (4/3)R  (см. вывод выше)
    const minArcPx = (4 / 3) * markerRadiusPx;

    // чтобы не потерять смысл “разные окружности”, группируем по радиусу (не по orbit)
    // округляем радиус до 0.5px, чтобы стабильно (и чтобы фиксированный “за горизонтом” схлопнулся)
    const bucketKey = (r: number) => Math.round(r * 2); // 0.5px buckets

    const byRing = new Map<number, MarkerItem[]>();
    for (const it of items) {
        const r = Math.max(1, getRadiusPx(it.orbit));
        const k = bucketKey(r);
        const arr = byRing.get(k);
        if (arr) arr.push(it);
        else byRing.set(k, [it]);
    }

    const out: MarkerCluster[] = [];

    for (const [k, ringItems] of byRing) {
        const r = Math.max(1, k / 2);

        const epsDeg = (minArcPx / r) * (180 / Math.PI);

        const list = ringItems
            .map(it => ({ it, a: norm360(it.angleDeg) }))
            .sort((x, y) => (x.a - y.a) || (x.it.ts - y.it.ts));

        // линейные кластера
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

        // wrap-around: склеиваем первый и последний, если близко через 360
        if (clusters.length >= 2) {
            const first = clusters[0];
            const last = clusters[clusters.length - 1];

            const wrapGap = (first.aFirst + 360) - last.aLast;
            if (wrapGap <= epsDeg) {
                // переносим углы first как +360, чтобы среднее было корректным
                const moved = first.items;
                const movedSum = moved.reduce((sum, it) => sum + (norm360(it.angleDeg) + 360), 0);

                last.items.push(...moved);
                last.aSum += movedSum;
                last.aLast = first.aLast + 360;

                clusters.shift();
            }
        }

        // финализация
        for (const cc of clusters) {
            const count = cc.items.length;
            const aAvg = cc.aSum / count;
            const aRender0_360 = norm360(aAvg);

            const itemsSortedByTs = cc.items.slice().sort((a, b) => a.ts - b.ts);
            const head = itemsSortedByTs[0];

            const id =
                count === 1
                    ? head.id
                    : `cluster:${head.collectionId}:${k}:${Math.round(aRender0_360 * 10)}:${count}`;

            out.push({
                id,
                ts: head.ts,
                angleDeg: toSignedAngle(aRender0_360),
                orbit: head.orbit, // любой из них; радиус уже зафиксирован через bucket
                bg: head.bg,
                count,
                emoji: count === 1 ? head.emoji : undefined,
                label: count > 1 ? String(count) : undefined,
                items: itemsSortedByTs,
                opacity: (head as any).opacity
            });
        }
    }

    return out;
}