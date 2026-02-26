// src/lib/wheel/ui/useCycleNowPointer.ts
import { onDestroy, onMount } from 'svelte';
import { get, writable } from 'svelte/store';

import { isLive, selectedTs, startLive } from '../../time/store';
import { ms } from '../../format';
import { isFiniteNumber } from '../../math/helpers';

export type NowPointerDbg = {
    log?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
};

type NowState = { show: boolean; angleDeg: number | null; displayAngle: number };

export function useCycleNowPointer(
    getWindow: () => { start: number; end: number } | null,
    getAngleDegAtTs: (ts: number) => number | null,
    dbg?: NowPointerDbg
) {
    let nowTs = ms(Date.now());
    let nowTimer: ReturnType<typeof setInterval> | null = null;
    let nowAlignTimer: ReturnType<typeof setTimeout> | null = null;

    let lastAngle = 0;

    const state = writable<NowState>({ show: false, angleDeg: null, displayAngle: 0 });

    function clearTimers() {
        if (nowAlignTimer) { clearTimeout(nowAlignTimer); nowAlignTimer = null; }
        if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
    }

    function tick(reason: string) {
        nowTs = ms(Date.now());
        const live = get(isLive);

        // Сейчас-pointer нужен как "Go LIVE" — показываем ТОЛЬКО когда global live=false
        if (live) {
            state.set({ show: false, angleDeg: null, displayAngle: 0 });
            lastAngle = 0;
            dbg?.log?.('[NOW] tick', { reason, live, show: false, why: 'isLive=true' });
            return;
        }

        const win = getWindow();
        if (!win || !isFiniteNumber(win.start) || !isFiniteNumber(win.end) || !(win.end > win.start)) {
            dbg?.warn?.('[NOW] tick', { reason, live, show: get(state).show, why: 'no/invalid window', win });
            return; // <-- КЛЮЧ: не сбрасываем показ стрелки из-за transient null
        }

        const inside = nowTs >= win.start && nowTs <= win.end;
        if (!inside) {
            state.set({ show: false, angleDeg: null, displayAngle: 0 });
            lastAngle = 0;
            dbg?.log?.('[NOW] tick', { reason, live, inside, show: false });
            return;
        }

        const a = getAngleDegAtTs(nowTs);
        const angleDeg = (a !== null && Number.isFinite(a)) ? a : null;

        let displayAngle = 0;
        if (angleDeg !== null) {
            let t = angleDeg;
            while (t - lastAngle > 180) t -= 360;
            while (t - lastAngle < -180) t += 360;
            displayAngle = t;
            lastAngle = t;
        } else {
            lastAngle = 0;
        }

        state.set({ show: angleDeg !== null, angleDeg, displayAngle });

        dbg?.log?.('[NOW] tick', {
            reason,
            live,
            window: { start: win.start, end: win.end },
            nowTs,
            inside,
            angleDeg,
            displayAngle
        });
    }

    const inst = Math.random().toString(36).slice(2, 7);
    dbg?.log?.('[NOW] init', { inst });

    function startTicker() {
        clearTimers();

        // ВАЖНО: первый тик сразу, без ожидания минуты
        tick('start');

        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);

        nowAlignTimer = setTimeout(() => {
            tick('align');
            nowTimer = setInterval(() => tick('interval'), 60_000);
        }, msToNextMinute + 5);
    }

    function refresh(reason = 'refresh') {
        tick(reason);
    }

    let unsubLive: (() => void) | null = null;
    let unsubSelected: (() => void) | null = null;

    onMount(() => {
        startTicker();

        // Дёргаем тик на любые изменения режима live
        unsubLive = isLive.subscribe(() => tick('isLive'));

        // КЛЮЧЕВОЕ: selectedTs меняется на клик по спице (setSelectedTs),
        // значит мы гарантированно тикаем сразу, не ждём минуту.
        unsubSelected = selectedTs.subscribe(() => tick('selectedTs'));
    });

    onDestroy(() => {
        clearTimers();
        unsubLive?.(); unsubLive = null;
        unsubSelected?.(); unsubSelected = null;
    });

    return { state, startLive, refresh };
}
