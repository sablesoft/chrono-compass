// src/lib/wheel/ui/useNowPointer.ts
import { onDestroy, onMount } from 'svelte';
import { get, writable } from 'svelte/store';
import { isLive, startLive } from '../../time/store';
import { ms } from '../../format';
import { computeAngle } from '../wheel';
import type { CycleKind } from '../../cycles/types';
import type { Anchors } from '../spokes';

export type NowPointerDbg = {
    log?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
};

function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function pickWindow(a: any): { start: number; end: number; reason: string } | null {
    if (isFiniteNumber(a?.start) && isFiniteNumber(a?.end)) {
        return { start: a.start, end: a.end, reason: 'anchors.start/end' };
    }
    if (isFiniteNumber(a?.E) && isFiniteNumber(a?.E_next)) {
        return { start: a.E, end: a.E_next, reason: 'anchors.E/E_next' };
    }
    return null;
}

export function useNowPointer(
    getKind: () => CycleKind,
    getAnchors: () => Anchors,
    dbg?: NowPointerDbg
) {
    let nowTs = ms(Date.now());
    let nowTimer: ReturnType<typeof setInterval> | null = null;
    let nowAlignTimer: ReturnType<typeof setTimeout> | null = null;

    let lastAngle = 0;

    const state = writable<{ show: boolean; angleDeg: number | null; displayAngle: number }>({
        show: false,
        angleDeg: null,
        displayAngle: 0
    });

    function clearTimers() {
        if (nowAlignTimer) { clearTimeout(nowAlignTimer); nowAlignTimer = null; }
        if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
    }

    function tick(reason: string) {
        nowTs = ms(Date.now());
        const live = get(isLive);
        const a = getAnchors();
        const win = pickWindow(a);

        if (live) {
            // когда live=true, стрелка "now" скрыта
            state.set({ show: false, angleDeg: null, displayAngle: 0 });
            dbg?.log?.('[NOW] tick', { reason, live, show: false, why: 'isLive=true' });
            lastAngle = 0;
            return;
        }

        if (!win) {
            state.set({ show: false, angleDeg: null, displayAngle: 0 });
            dbg?.warn?.('[NOW] tick', { reason, live, show: false, why: 'no window', anchors: a });
            lastAngle = 0;
            return;
        }

        const inside = nowTs >= win.start && nowTs <= win.end;
        const angleDeg = inside ? computeAngle(getKind(), nowTs, a) : null;

        let displayAngle = 0;
        if (inside && angleDeg !== null && Number.isFinite(angleDeg)) {
            let t = angleDeg;
            while (t - lastAngle > 180) t -= 360;
            while (t - lastAngle < -180) t += 360;
            displayAngle = t;
            lastAngle = t;
        } else {
            lastAngle = 0;
        }

        state.set({ show: inside, angleDeg, displayAngle });

        dbg?.log?.('[NOW] tick', {
            reason,
            live,
            window: { start: win.start, end: win.end, source: win.reason },
            nowTs,
            inside,
            angleDeg,
            displayAngle
        });
    }

    function startTicker() {
        clearTimers();
        tick('start');

        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);

        nowAlignTimer = setTimeout(() => {
            tick('align');
            nowTimer = setInterval(() => tick('interval'), 60_000);
        }, msToNextMinute + 5);
    }

    // NEW: дергаем пересчет вручную, когда внешние зависимости поменялись
    function refresh(reason = 'refresh') {
        tick(reason);
    }

    let unsubLive: (() => void) | null = null;

    onMount(() => {
        startTicker();

        // NEW: isLive переключили — пересчитать сразу, не ждать минуты
        unsubLive = isLive.subscribe(() => tick('isLive'));
    });

    onDestroy(() => {
        clearTimers();
        unsubLive?.();
        unsubLive = null;
    });

    return {
        state,
        startLive,
        refresh
    };
}