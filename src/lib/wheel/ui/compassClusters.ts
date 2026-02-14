// src/lib/wheel/compassClusters.ts
import type { MarkerItem, MarkerCluster } from '../wheel';
import {norm360} from "../../math/helpers";

function toSignedAngle(deg0_360: number): number {
    let a = norm360(deg0_360);
    if (a > 180) a -= 360;
    return a;
}

// если у тебя opacity ещё не в MarkerItem типе — оставим мягко
function itemOpacity(it: MarkerItem): number | undefined {
    return (it as any).opacity;
}

function finiteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

/**
 * КРУТИЛКА КЛАСТЕРИЗАЦИИ:
 * dist < (CLUSTER_DISTANCE_FACTOR * markerRadiusPx) => items сливаются
 *
 * Было раньше: 4/3 ≈ 1.333 (довольно агрессивно).
 * Хочешь реже сливать: 1.15 / 1.10 / 1.00
 */
export const CLUSTER_DISTANCE_FACTOR = 0.75;

export function compassClusters(
    items: MarkerItem[],
    getRadiusPx: (orbit: number) => number,
    markerRadiusPx: number
): MarkerCluster[] {
    if (!items.length) return [];

    const thresholdPx = CLUSTER_DISTANCE_FACTOR * markerRadiusPx;

    // точки в локальных координатах (относительно центра)
    const pts = items.map((it) => {
        const r = Math.max(0, getRadiusPx(it.orbit));
        const aRad = (it.angleDeg * Math.PI) / 180;
        const x = r * Math.cos(aRad);
        const y = r * Math.sin(aRad);
        return { it, x, y };
    });

    // стабильность: сортируем как раньше
    pts.sort(
        (a, b) =>
            (a.it.orbit - b.it.orbit) ||
            (norm360(a.it.angleDeg) - norm360(b.it.angleDeg)) ||
            (a.it.ts - b.it.ts)
    );

    // Union-Find
    const n = pts.length;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };

    const union = (a: number, b: number) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[rb] = ra;
    };

    // O(n^2) — targets обычно мало
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = pts[i].x - pts[j].x;
            const dy = pts[i].y - pts[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < thresholdPx) union(i, j);
        }
    }

    // компоненты
    const groups = new Map<number, MarkerItem[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const arr = groups.get(root);
        if (arr) arr.push(pts[i].it);
        else groups.set(root, [pts[i].it]);
    }

    const out: MarkerCluster[] = [];

    for (const group of groups.values()) {
        const itemsSortedByTs = group.slice().sort((a, b) => a.ts - b.ts);
        const head = itemsSortedByTs[0];
        const count = itemsSortedByTs.length;

        // opacity кластера: min(opacity) (undefined => 1)
        let minOpacity = 1;
        let sawOpacity = false;
        for (const it of itemsSortedByTs) {
            const o = itemOpacity(it);
            if (finiteNumber(o)) {
                sawOpacity = true;
                if (o < minOpacity) minOpacity = o;
            }
        }
        const opacity = sawOpacity ? minOpacity : itemOpacity(head);

        // средняя позиция кластера в 2D
        let sx = 0;
        let sy = 0;
        for (const it of itemsSortedByTs) {
            const r = Math.max(0, getRadiusPx(it.orbit));
            const aRad = (it.angleDeg * Math.PI) / 180;
            sx += r * Math.cos(aRad);
            sy += r * Math.sin(aRad);
        }
        sx /= count;
        sy /= count;

        const aAvgRad = Math.atan2(sy, sx);
        const aAvgDeg0_360 = norm360((aAvgRad * 180) / Math.PI);

        const id =
            count === 1
                ? head.id
                : `cluster:${head.collectionId}:${head.ts}:${Math.round(aAvgDeg0_360 * 10)}:${count}`;

        out.push({
            id,
            ts: head.ts,
            angleDeg: toSignedAngle(aAvgDeg0_360),
            orbit: head.orbit, // без обратного r->orbit оставляем так (стабильно)
            bg: head.bg,
            count,
            emoji: count === 1 ? head.emoji : undefined,
            label: count > 1 ? String(count) : undefined,
            items: itemsSortedByTs,
            opacity
        });
    }

    out.sort(
        (a, b) =>
            (a.orbit - b.orbit) ||
            (norm360(a.angleDeg) - norm360(b.angleDeg)) ||
            (a.ts - b.ts)
    );

    return out;
}
