// src/lib/wheel/ui/useWheelResponsive.ts
import { onDestroy, onMount } from 'svelte';

export function useWheelResponsive() {
    let wrapEl: HTMLDivElement | null = null;
    let ro: ResizeObserver | null = null;
    let size = 360;

    let isCoarsePointer = false;
    let mqCoarse: MediaQueryList | null = null;
    let isPhoneLayout = false;
    let mqPhone: MediaQueryList | null = null;

    function updatePointerMode() {
        isCoarsePointer = !!mqCoarse?.matches;
    }

    function updatePhoneLayoutMode() {
        isPhoneLayout = !!mqPhone?.matches;
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
            mqPhone = window.matchMedia('(max-width: 640px)');
            updatePointerMode();
            updatePhoneLayoutMode();
            const onPointerChange = () => updatePointerMode();
            const onPhoneChange = () => updatePhoneLayoutMode();
            if ('addEventListener' in mqCoarse) mqCoarse.addEventListener('change', onPointerChange);
            else (mqCoarse as any).addListener(onPointerChange);
            if (mqPhone) {
                if ('addEventListener' in mqPhone) mqPhone.addEventListener('change', onPhoneChange);
                else (mqPhone as any).addListener(onPhoneChange);
            }

            return () => {
                if (!mqCoarse) return;
                if ('removeEventListener' in mqCoarse) mqCoarse.removeEventListener('change', onPointerChange);
                else (mqCoarse as any).removeListener(onPointerChange);
                if (!mqPhone) return;
                if ('removeEventListener' in mqPhone) mqPhone.removeEventListener('change', onPhoneChange);
                else (mqPhone as any).removeListener(onPhoneChange);
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
        get isPhoneLayout() { return isPhoneLayout; },
    };
}
