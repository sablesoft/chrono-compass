// src/lib/wheel/ui/useTooltip.ts
import { onDestroy, onMount } from 'svelte';
import { writable } from 'svelte/store';
import type { MarkerCluster, MomentTip } from '../wheel';

export type TooltipState = {
    open: boolean;
    x: number;
    y: number;
    moment: MomentTip | null;
    cluster: MarkerCluster | null;
};

export function useTooltip(args: {
    isCoarsePointer: () => boolean;
    onActivateCluster: (c: MarkerCluster) => void;

    // задержка перед показом tooltip по hover
    hoverDelayMs?: number;

    // задержка закрытия после leave (чтобы успеть навести на сам tooltip)
    closeDelayMs?: number;

    // селекторы, внутри которых "outside click" не закрывает tooltip
    ignoreOutsideSelectors?: string[];
}) {
    const hoverDelayMs = args.hoverDelayMs ?? 600;
    const closeDelayMs = args.closeDelayMs ?? 120;
    const ignoreSelectors = args.ignoreOutsideSelectors ?? ['[data-tooltip-root]', '[data-marker]'];

    const state = writable<TooltipState>({
        open: false, x: 0, y: 0, moment: null, cluster: null
    });

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    // "токен" и "активный hover key" чтобы отменять предыдущие ожидания
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

    function setMomentNow(e: MouseEvent, tip: MomentTip) {
        clearHideTimer();
        clearHoverTimer();
        state.set({ open: true, x: e.clientX, y: e.clientY, moment: tip, cluster: null });
    }

    function setClusterNow(e: MouseEvent, c: MarkerCluster) {
        clearHideTimer();
        clearHoverTimer();
        state.set({ open: true, x: e.clientX, y: e.clientY, moment: null, cluster: c });
    }

    // ---------- Hover API (главное) ----------
    // key — уникальный id зоны: `spoke:${i}`, `boundary:${i}`, `marker:${c.id}`, `eplus`
    function hoverMomentEnter(e: MouseEvent, tip: MomentTip, key: string) {
        if (args.isCoarsePointer()) return; // на coarse hover не нужен

        clearHideTimer();

        // если уже ждём/показываем тот же key — просто обновим позицию
        activeHoverKey = key;
        const myRun = ++hoverRun;
        if (hoverTimer) clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            if (hoverRun !== myRun) return;          // отменили новым enter/leave
            if (activeHoverKey !== key) return;      // ушли на другую зону
            state.set({ open: true, x: e.clientX, y: e.clientY, moment: tip, cluster: null });
            hoverTimer = null;
        }, hoverDelayMs);
    }

    function hoverClusterEnter(e: MouseEvent, c: MarkerCluster, key: string) {
        if (args.isCoarsePointer()) return;

        clearHideTimer();
        activeHoverKey = key;
        const myRun = ++hoverRun;
        if (hoverTimer) clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            if (hoverRun !== myRun) return;
            if (activeHoverKey !== key) return;
            state.set({ open: true, x: e.clientX, y: e.clientY, moment: null, cluster: c });
            hoverTimer = null;
        }, hoverDelayMs);
    }

    function hoverLeave(key: string) {
        // если мы уходили до завершения задержки — отменяем показ
        if (activeHoverKey === key) {
            clearHoverTimer();
        }
        scheduleClose();
    }

    function move(e: MouseEvent) {
        state.update(s => s.open ? ({ ...s, x: e.clientX, y: e.clientY }) : s);
    }

    function scheduleClose() {
        clearHideTimer();
        hideTimer = setTimeout(() => {
            state.set({ open: false, x: 0, y: 0, moment: null, cluster: null });
            hideTimer = null;
        }, closeDelayMs);
    }

    function keepOpen() {
        clearHideTimer();
    }

    function closeNow() {
        clearHideTimer();
        clearHoverTimer();
        state.set({ open: false, x: 0, y: 0, moment: null, cluster: null });
    }

    // click по маркеру: coarse = toggle tooltip, fine = activate
    function handleClusterClick(e: MouseEvent, c: MarkerCluster) {
        if (args.isCoarsePointer()) {
            clearHideTimer();
            clearHoverTimer();
            state.update(s => {
                const same = s.open && s.cluster?.id === c.id;
                return same
                    ? { open: false, x: 0, y: 0, moment: null, cluster: null }
                    : { open: true, x: e.clientX, y: e.clientY, moment: null, cluster: c };
            });
            return;
        }
        args.onActivateCluster(c);
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

        // immediate open (если хочешь показывать tooltip по клику)
        openMomentNow: setMomentNow,
        openClusterNow: setClusterNow,

        // hover open (с задержкой и отменой)
        hoverMomentEnter,
        hoverClusterEnter,
        hoverLeave,

        move,
        scheduleClose,
        keepOpen,
        closeNow,
        handleClusterClick,
    };
}
