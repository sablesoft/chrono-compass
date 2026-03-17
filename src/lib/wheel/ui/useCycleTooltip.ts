// src/lib/wheel/ui/useCycleTooltip.ts
import { onDestroy, onMount } from 'svelte';
import { writable } from 'svelte/store';

export type CycleTipSpoke = {
    kind: 'spoke';
    code: string;          // 'E', 'N', ... or 'E_next'
    ts: number;
    pickTs?: number;       // optional action timestamp (can differ from display ts)
    meta?: any;            // cycle-specific meta (BindMeta etc)
    tags?: string[];
    items?: Array<{ id?: string; label: string; value?: string; modal?: string }>;
};

export type CycleTipBoundary = {
    kind: 'boundary';
    from: string;          // 'E'
    to: string;            // 'ENE'
    ts: number;
    pickTs?: number;
    meta?: any;
    tags?: string[];
    items?: Array<{ id?: string; label: string; value?: string; modal?: string }>;
};

export type CycleTipMarker = {
    kind: 'marker';
    id: string;
    label: string;
    angleDeg: number;
    bg?: string;
    orbit?: number;

    // ВАЖНО: вместо "moment" — список моментов внутри маркера/кластера
    // (когда кластеризация включится)
    moments: Array<{
        id?: string;
        label: string;
        ts: number;
        emoji?: string;
        meta?: any;
    }>;
};

export type CycleTipPayload = CycleTipSpoke | CycleTipBoundary | CycleTipMarker;

export type CycleTooltipState = {
    open: boolean;
    x: number;
    y: number;
    payload: CycleTipPayload | null;
};

export function useCycleTooltip(args: {
    isCoarsePointer: () => boolean;
    isDoubleTapRequired?: () => boolean;
    onActivateMarker?: (m: CycleTipMarker) => void;

    hoverDelayMs?: number;
    closeDelayMs?: number;
    ignoreOutsideSelectors?: string[];
}) {
    const hoverDelayMs = args.hoverDelayMs ?? 600;
    const closeDelayMs = args.closeDelayMs ?? 120;
    const ignoreSelectors = args.ignoreOutsideSelectors ?? ['[data-tooltip-root]', '[data-marker]'];

    const state = writable<CycleTooltipState>({
        open: false, x: 0, y: 0, payload: null
    });

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTap: { key: string; at: number; x: number; y: number } | null = null;

    const DOUBLE_TAP_MS = 360;
    const DOUBLE_TAP_MAX_DIST_PX = 28;

    let hoverRun = 0;
    let activeHoverKey: string | null = null;

    function clearHideTimer() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }

    function clearHoverTimer() {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        activeHoverKey = null;
        hoverRun++;
    }

    function payloadTapKey(payload: CycleTipPayload): string {
        if (payload.kind === 'marker') return `marker:${payload.id}`;
        if (payload.kind === 'spoke') return `spoke:${payload.code}:${payload.ts}`;
        return `boundary:${payload.from}:${payload.to}:${payload.ts}`;
    }

    function shouldOpenNowByTap(e: MouseEvent, key: string): boolean {
        const needsDoubleTap = args.isDoubleTapRequired ? args.isDoubleTapRequired() : args.isCoarsePointer();
        if (!needsDoubleTap) return true;
        if (e.detail === 0) return true;

        const now = Date.now();
        const x = e.clientX;
        const y = e.clientY;
        const prev = lastTap;
        lastTap = { key, at: now, x, y };

        if (!prev) return false;
        if (prev.key !== key) return false;
        if ((now - prev.at) > DOUBLE_TAP_MS) return false;

        const dx = x - prev.x;
        const dy = y - prev.y;
        return (dx * dx + dy * dy) <= (DOUBLE_TAP_MAX_DIST_PX * DOUBLE_TAP_MAX_DIST_PX);
    }

    function openNow(e: MouseEvent, payload: CycleTipPayload) {
        if (!shouldOpenNowByTap(e, payloadTapKey(payload))) return;
        clearHideTimer();
        clearHoverTimer();
        state.set({ open: true, x: e.clientX, y: e.clientY, payload });
    }

    // key — уникальный id зоны: `spoke:${i}`, `boundary:${i}`, `marker:${id}`
    function hoverEnter(e: MouseEvent, payload: CycleTipPayload, key: string) {
        if (args.isCoarsePointer()) return;

        clearHideTimer();
        activeHoverKey = key;

        const myRun = ++hoverRun;
        if (hoverTimer) clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            if (hoverRun !== myRun) return;
            if (activeHoverKey !== key) return;
            state.set({ open: true, x: e.clientX, y: e.clientY, payload });
            hoverTimer = null;
        }, hoverDelayMs);
    }

    function hoverLeave(key: string) {
        if (activeHoverKey === key) clearHoverTimer();
        scheduleClose();
    }

    function move(e: MouseEvent) {
        state.update(s => s.open ? ({ ...s, x: e.clientX, y: e.clientY }) : s);
    }

    function scheduleClose() {
        clearHideTimer();
        hideTimer = setTimeout(() => {
            state.set({ open: false, x: 0, y: 0, payload: null });
            hideTimer = null;
        }, closeDelayMs);
    }

    function keepOpen() {
        clearHideTimer();
    }

    function closeNow() {
        clearHideTimer();
        clearHoverTimer();
        lastTap = null;
        state.set({ open: false, x: 0, y: 0, payload: null });
    }

    function handleGlobalPointerDown(e: PointerEvent | MouseEvent) {
        let isOpen = false;
        state.update(s => { isOpen = s.open; return s; });
        if (!isOpen) return;

        const el = e.target as Element | null;
        if (!el) return;

        for (const sel of ignoreSelectors) {
            if (el.closest(sel)) return;
        }
        closeNow();
    }

    onMount(() => {
        window.addEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
    });

    onDestroy(() => {
        window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true } as any);
        clearHideTimer();
        clearHoverTimer();
    });

    return {
        state,
        openNow,
        hoverEnter,
        hoverLeave,
        move,
        scheduleClose,
        keepOpen,
        closeNow
    };
}
