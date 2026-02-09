// src/lib/wheel/ui/useNowPointer.ts
import { onDestroy, onMount } from 'svelte';
import { get } from 'svelte/store';
import { isLive, startLive } from '../../stores/time';
import { ms } from '../../format';
import { computeAngle } from '../wheel';
import type { CycleKind } from '../../cycles/types';
import type { Anchors } from '../spokes';

export function useNowPointer(getKind: () => CycleKind, getAnchors: () => Anchors) {
    let nowTs = ms(Date.now());
    let nowTimer: ReturnType<typeof setInterval> | null = null;
    let nowAlignTimer: ReturnType<typeof setTimeout> | null = null;

    let show = false;
    let angleDeg: number | null = null;

    let displayAngle = 0;
    let lastAngle = 0;

    function clearTimers() {
        if (nowAlignTimer) { clearTimeout(nowAlignTimer); nowAlignTimer = null; }
        if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
    }

    function tick() {
        nowTs = ms(Date.now());
        const live = get(isLive);
        const a = getAnchors();
        if (live) { show = false; angleDeg = null; return; }
        const inside = nowTs >= a.start && nowTs <= a.end;
        show = inside;
        angleDeg = inside ? computeAngle(getKind(), nowTs, a) : null;

        if (show && angleDeg !== null) {
            const target = Number.isFinite(angleDeg) ? angleDeg : lastAngle;
            let t = target;
            while (t - lastAngle > 180) t -= 360;
            while (t - lastAngle < -180) t += 360;
            displayAngle = t;
            lastAngle = t;
        }
    }

    function startTicker() {
        clearTimers();
        tick();
        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);
        nowAlignTimer = setTimeout(() => {
            tick();
            nowTimer = setInterval(tick, 60_000);
        }, msToNextMinute + 5);
    }

    onMount(startTicker);
    onDestroy(clearTimers);

    return {
        get show() { return show; },
        get angleDeg() { return angleDeg; },
        get displayAngle() { return displayAngle; },
        startLive
    };
}