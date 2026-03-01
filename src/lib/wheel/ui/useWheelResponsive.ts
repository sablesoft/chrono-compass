// src/lib/wheel/ui/useWheelResponsive.ts
import { onDestroy, onMount } from 'svelte';

export function useWheelResponsive() {
    let wrapEl: HTMLDivElement | null = null;
    let ro: ResizeObserver | null = null;
    let size = 360;

    let isCoarsePointer = false;
    let mqCoarse: MediaQueryList | null = null;

    function updatePointerMode() {
        isCoarsePointer = !!mqCoarse?.matches;
    }

    function recomputeWheelSize() {
        if (!wrapEl) return;
        const style = getComputedStyle(wrapEl);
        const pl = parseFloat(style.paddingLeft) || 0;
        const pr = parseFloat(style.paddingRight) || 0;
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;
        const innerW = Math.max(0, wrapEl.clientWidth - pl - pr);
        const innerH = Math.max(0, wrapEl.clientHeight - pt - pb);
        const available = Math.floor(Math.min(innerW, innerH));
        const sizeByPad = Math.floor(available / 1.1);
        size = Math.max(320, sizeByPad - 2);
    }

    onMount(() => {
        queueMicrotask(recomputeWheelSize);

        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(recomputeWheelSize);
            ro.observe(wrapEl);
        }

        if ('matchMedia' in window) {
            mqCoarse = window.matchMedia('(pointer: coarse)');
            updatePointerMode();
            const onChange = () => updatePointerMode();
            if ('addEventListener' in mqCoarse) mqCoarse.addEventListener('change', onChange);
            else (mqCoarse as any).addListener(onChange);

            return () => {
                if (!mqCoarse) return;
                if ('removeEventListener' in mqCoarse) mqCoarse.removeEventListener('change', onChange);
                else (mqCoarse as any).removeListener(onChange);
            };
        }
    });

    onDestroy(() => {
        if (ro && wrapEl) ro.unobserve(wrapEl);
        ro?.disconnect();
    });

    return {
        bindWrap: (el: HTMLDivElement | null) => { wrapEl = el; },
        get size() { return size; },
        get isCoarsePointer() { return isCoarsePointer; },
    };
}
