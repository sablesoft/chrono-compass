export const BOARD_GRID_COLUMNS = 24;
export const BOARD_DEFAULT_W = 8;
export const BOARD_DEFAULT_H = 10;

export type BoardLayoutRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export type LayoutItem<TId extends string = string> = {
    id: TId;
    rect: BoardLayoutRect;
};

function clampInt(v: number, lo: number, hi: number): number {
    if (!Number.isFinite(v)) return lo;
    const n = Math.round(v);
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
}

export function normalizeRect(
    input: Partial<BoardLayoutRect> | null | undefined,
    cols = BOARD_GRID_COLUMNS
): BoardLayoutRect {
    const w = clampInt(input?.w ?? BOARD_DEFAULT_W, 1, cols);
    const h = clampInt(input?.h ?? BOARD_DEFAULT_H, 1, 10_000);
    const x = clampInt(input?.x ?? 0, 0, Math.max(0, cols - w));
    const y = clampInt(input?.y ?? 0, 0, 10_000_000);
    return { x, y, w, h };
}

function intersects(a: BoardLayoutRect, b: BoardLayoutRect): boolean {
    if (a.x + a.w <= b.x) return false;
    if (b.x + b.w <= a.x) return false;
    if (a.y + a.h <= b.y) return false;
    if (b.y + b.h <= a.y) return false;
    return true;
}

function collidesWithAny(
    rect: BoardLayoutRect,
    items: LayoutItem[],
    skipId: string | null = null
): boolean {
    for (const it of items) {
        if (skipId && it.id === skipId) continue;
        if (intersects(rect, it.rect)) return true;
    }
    return false;
}

function firstFit(items: LayoutItem[], w: number, h: number, cols: number): BoardLayoutRect {
    const ww = clampInt(w, 1, cols);
    const hh = clampInt(h, 1, 10_000);

    let y = 0;
    while (y < 200_000) {
        for (let x = 0; x <= cols - ww; x++) {
            const rect = { x, y, w: ww, h: hh };
            if (!collidesWithAny(rect, items)) return rect;
        }
        y += 1;
    }

    return { x: 0, y, w: ww, h: hh };
}

export function compactLayout(items: LayoutItem[], cols = BOARD_GRID_COLUMNS): LayoutItem[] {
    const normalized = items
        .map((it) => ({ id: it.id, rect: normalizeRect(it.rect, cols) }))
        .sort((a, b) => {
            if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
            if (a.rect.x !== b.rect.x) return a.rect.x - b.rect.x;
            return a.id.localeCompare(b.id);
        });

    const out: LayoutItem[] = [];
    for (const it of normalized) {
        const fit = firstFit(out, it.rect.w, it.rect.h, cols);
        out.push({ id: it.id, rect: fit });
    }
    return out;
}

export function buildLayoutForIds(
    idsInOrder: string[],
    existing: Map<string, BoardLayoutRect>,
    cols = BOARD_GRID_COLUMNS
): Map<string, BoardLayoutRect> {
    const seed: LayoutItem[] = idsInOrder.map((id) => ({
        id,
        rect: normalizeRect(existing.get(id), cols)
    }));

    const packed = compactLayout(seed, cols);
    return new Map(packed.map((it) => [it.id, it.rect]));
}

export function insertAtFirstFit(
    existing: Map<string, BoardLayoutRect>,
    id: string,
    size: { w?: number; h?: number } = {},
    cols = BOARD_GRID_COLUMNS
): Map<string, BoardLayoutRect> {
    const items: LayoutItem[] = Array.from(existing.entries()).map(([itemId, rect]) => ({
        id: itemId,
        rect: normalizeRect(rect, cols)
    }));

    const rect = firstFit(items, size.w ?? BOARD_DEFAULT_W, size.h ?? BOARD_DEFAULT_H, cols);
    const next = new Map(existing);
    next.set(id, rect);
    return next;
}

export function nextFreeRect(
    existing: Map<string, BoardLayoutRect>,
    size: { w?: number; h?: number } = {},
    cols = BOARD_GRID_COLUMNS
): BoardLayoutRect {
    const items: LayoutItem[] = Array.from(existing.entries()).map(([itemId, rect]) => ({
        id: itemId,
        rect: normalizeRect(rect, cols)
    }));
    return firstFit(items, size.w ?? BOARD_DEFAULT_W, size.h ?? BOARD_DEFAULT_H, cols);
}

export function moveAndCompact(
    existing: Map<string, BoardLayoutRect>,
    id: string,
    target: Partial<BoardLayoutRect>,
    order: string[],
    cols = BOARD_GRID_COLUMNS
): Map<string, BoardLayoutRect> {
    const current = existing.get(id);
    const base = normalizeRect(
        {
            ...(current ?? { x: 0, y: 0, w: BOARD_DEFAULT_W, h: BOARD_DEFAULT_H }),
            ...target
        },
        cols
    );

    const items: LayoutItem[] = [];
    for (const itemId of order) {
        if (itemId === id) continue;
        const r = normalizeRect(existing.get(itemId), cols);
        items.push({ id: itemId, rect: r });
    }

    let placed = base;
    while (collidesWithAny(placed, items)) {
        placed = { ...placed, y: placed.y + 1 };
        if (placed.y > 200_000) break;
    }

    items.push({ id, rect: placed });

    const rank = new Map(order.map((itemId, i) => [itemId, i]));
    const packed = items
        .slice()
        .sort((a, b) => {
            const ar = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const br = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            return ar - br;
        });

    const compacted = compactLayout(packed, cols);
    return new Map(compacted.map((it) => [it.id, it.rect]));
}
