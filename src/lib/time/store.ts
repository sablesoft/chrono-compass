// src/lib/time/store.ts
import { writable, derived, get } from 'svelte/store';
import { ms } from '../format';
import type { GlobalTimeState } from './types';

const DEFAULT: GlobalTimeState = {
    live: true,
    locked: false
};

// внутреннее “текущее время” для live-режима (оно и даёт реактивность)
const liveNowTs = writable<number>(ms(Date.now()));

export const globalTime = writable<GlobalTimeState>(DEFAULT);

/**
 * Backward-compatible API:
 * - selectedTs: всегда “эффективное” время (live → liveNowTs, not live → globalTime.ts)
 * - isLive: флаг live
 */
export const selectedTs = derived(
    [globalTime, liveNowTs],
    ([$gt, $liveNow]): number => {
        if ($gt.live) return $liveNow;
        return ms($gt.ts ?? $liveNow);
    }
);

export const isLive = derived(globalTime, ($gt) => !!$gt.live);
export const isGlobalTimeLocked = derived(globalTime, ($gt) => !!$gt.locked);

// --- live scheduler (no drift): chain setTimeout to the next minute boundary ---
let liveTickTimer: ReturnType<typeof setTimeout> | null = null;

function clearLiveTimers() {
    if (liveTickTimer) {
        clearTimeout(liveTickTimer);
        liveTickTimer = null;
    }
}

function setLiveNowSystem(ts: number) {
    liveNowTs.set(ms(ts));
}

function scheduleNextMinuteTick() {
    clearLiveTimers();

    // если live уже выключили — не планируем
    const gt = get(globalTime);
    if (!gt.live) return;

    const now = Date.now();
    const msToNextMinute = 60_000 - (now % 60_000);

    // небольшой буфер, чтобы гарантированно перескочить границу минуты
    const fudge = 20;

    liveTickTimer = setTimeout(() => {
        // обновляем “сейчас”
        setLiveNowSystem(Date.now());
        // и снова планируем — каждый раз пересчитываем, дрейфа нет
        scheduleNextMinuteTick();
    }, msToNextMinute + fudge);
}

/**
 * Гарантирует, что live-тикер реально запущен.
 * Важно: DEFAULT.live=true → startLive() может не выполняться из App,
 * поэтому таймеры должны уметь стартовать даже если live уже включен.
 */
function ensureLiveRunning() {
    // даже если таймер уже есть — всё равно сделаем мягкий ресинк “сейчас”
    setLiveNowSystem(Date.now());
    scheduleNextMinuteTick();
}

// вкладка проснулась → ресинк, иначе можно получить “ждать полминуты”
let visHandlerAttached = false;
function ensureVisibilitySync() {
    if (visHandlerAttached) return;
    visHandlerAttached = true;

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && get(globalTime).live) {
                ensureLiveRunning();
            }
        });
    }
}

export function stopLive() {
    const gt = get(globalTime);
    if (!gt.live) return;

    clearLiveTimers();

    // выходим из live → фиксируемся на “сейчас”
    globalTime.set({
        ...gt,
        live: false,
        ts: ms(Date.now())
    });
}

export function startLive() {
    const gt = get(globalTime);

    // если live ещё не включен — включаем
    if (!gt.live) {
        globalTime.set({
            ...gt,
            live: true
            // ts не кладём специально (по контракту ts только когда live=false)
        });
    }

    ensureVisibilitySync();
    ensureLiveRunning();
}

/**
 * “пользовательское” изменение выбранного времени (выключает live).
 * Это СЧИТАЕМ действием из глобального пикера/хедера, поэтому игнорируем locked.
 */
export function setSelectedTs(ts: number) {
    const gt = get(globalTime);

    clearLiveTimers();

    globalTime.set({
        ...gt,
        live: false,
        ts: ms(ts)
    });
}

export function toggleLive() {
    const gt = get(globalTime);

    if (gt.live) stopLive();
    else startLive();
}

export function toggleGlobalTimeLock() {
    globalTime.update((s) => ({ ...s, locked: !s.locked }));
}

// Авто-старт таймера при импорте модуля, если live включен по дефолту/из persisted state
if (typeof window !== 'undefined') {
    ensureVisibilitySync();

    const gt = get(globalTime);
    if (gt.live) ensureLiveRunning();
}
