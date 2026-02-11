// src/lib/wheel/compassClusters.ts
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

// если у тебя opacity ещё не в MarkerItem типе — оставим мягко
function itemOpacity(it: MarkerItem): number | undefined {
    return (it as any).opacity;
}

function finiteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

/**
 * Compass clustering (2D, по экранной дистанции):
 * - "сливать", если перекрытие > 1/3  => dist < (4/3)*R
 * - учитывает и разные орбиты (высоты): сравниваем в 2D, а не по дуге на кольце
 * - прозрачность кластера: min(opacity) внутри (undefined считается как 1)
 *
 * Важно: this file НЕ знает про SVG-геометрию (cx/cy). Поэтому считаем дистанцию
 * по локальным координатам относительно центра: (r*cos(a), r*sin(a)).
 * Это эквивалентно реальным SVG координатам для сравнения дистанций.
 */
export function compassClusters(
    items: MarkerItem[],
    getRadiusPx: (orbit: number) => number,
    markerRadiusPx: number
): MarkerCluster[] {
    if (!items.length) return [];

    // overlap>1/3 => dist < (4/3)R
    const thresholdPx = (4 / 3) * markerRadiusPx;

    // подготовим точки в "локальных" координатах (относительно центра)
    const pts = items.map((it) => {
        const r = Math.max(0, getRadiusPx(it.orbit));
        const aRad = (it.angleDeg * Math.PI) / 180;
        const x = r * Math.cos(aRad);
        const y = r * Math.sin(aRad);
        return { it, r, x, y };
    });

    // чтобы кластеры были стабильными (и не зависели от порядка в массиве),
    // сортируем по orbit/angle/ts — как раньше
    pts.sort((a, b) => (a.it.orbit - b.it.orbit) || (norm360(a.it.angleDeg) - norm360(b.it.angleDeg)) || (a.it.ts - b.it.ts));

    // простой Union-Find: если A близко к B -> одна компонента
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

    // O(n^2) — для компаса targets обычно мало (Sun/Moon/планеты/пара объектов), норм.
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = pts[i].x - pts[j].x;
            const dy = pts[i].y - pts[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < thresholdPx) union(i, j);
        }
    }

    // соберём компоненты
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

        // кластерная прозрачность: min(opacity) (undefined => 1)
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

        // угол и орбиту берём как "средние" в 2D, чтобы кластер рисовался ровно между ними
        // (это и решает твой кейс: Солнце+Луна чуть разные по высоте, но кластер будет в середине)
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
        const rAvg = Math.hypot(sx, sy);

        // обратного преобразования r->orbit у нас нет (и не надо):
        // берём orbit головы, а позиционирование по углу будет точным.
        // Чтобы кластер реально оказался "между" по радиусу тоже, можно сделать "виртуальный orbit"
        // через долю от r в вашей шкале. Но без знания шкалы это опасно.
        // Поэтому: orbit = head.orbit (как раньше), а угол — средний 2D.
        //
        // Если хочешь прям идеал: добавь в сигнатуру getOrbitFromRadius или отдавай orbitToRadiusVB,
        // но это уже отдельный рефактор.
        const id =
            count === 1
                ? head.id
                : `cluster:${head.collectionId}:${head.ts}:${Math.round(aAvgDeg0_360 * 10)}:${count}`;

        out.push({
            id,
            ts: head.ts,
            angleDeg: toSignedAngle(aAvgDeg0_360),
            orbit: head.orbit,
            bg: head.bg,
            count,
            emoji: count === 1 ? head.emoji : undefined,
            label: count > 1 ? String(count) : undefined,
            items: itemsSortedByTs,
            opacity
        });
    }

    // стабильный порядок рендера
    out.sort((a, b) => (a.orbit - b.orbit) || (norm360(a.angleDeg) - norm360(b.angleDeg)) || (a.ts - b.ts));

    return out;
}