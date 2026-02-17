// src/lib/wheel/ui/useCycleTooltip.ts
import { onDestroy, onMount } from 'svelte';
import { writable } from 'svelte/store';

export type CycleTipSpoke = {
    kind: 'spoke';
    code: string;          // 'E', 'N', ... or 'E_next'
    ts: number;
    meta?: any;            // cycle-specific meta (BindMeta etc)
};

export type CycleTipBoundary = {
    kind: 'boundary';
    from: string;          // 'E'
    to: string;            // 'ENE'
    ts: number;
    meta?: any;
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

    function openNow(e: MouseEvent, payload: CycleTipPayload) {
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
        state.set({ open: false, x: 0, y: 0, payload: null });
    }

    function handleMarkerClick(e: MouseEvent, marker: CycleTipMarker) {
        if (args.isCoarsePointer()) {
            clearHideTimer();
            clearHoverTimer();
            state.update(s => {
                const same = s.open && (s.payload?.kind === 'marker') && (s.payload.id === marker.id);
                return same
                    ? { open: false, x: 0, y: 0, payload: null }
                    : { open: true, x: e.clientX, y: e.clientY, payload: marker };
            });
            return;
        }
        args.onActivateMarker?.(marker);
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
        closeNow,
        handleMarkerClick,
    };
}
