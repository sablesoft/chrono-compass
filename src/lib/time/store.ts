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

// внутренние таймеры (живут здесь, а не в App)
let liveTimer: ReturnType<typeof setInterval> | null = null;
let liveAlignTimer: ReturnType<typeof setTimeout> | null = null;

function clearLiveTimers() {
    if (liveAlignTimer) { clearTimeout(liveAlignTimer); liveAlignTimer = null; }
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

function setLiveNowSystem(ts: number) {
    liveNowTs.set(ms(ts));
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
    if (gt.live) return;

    // включаем live
    globalTime.set({
        ...gt,
        live: true
        // ts не кладём специально (по контракту ts только когда live=false)
    });

    // сразу ставим актуальное время
    setLiveNowSystem(Date.now());

    // выравниваемся на следующую границу минуты
    const now = Date.now();
    const msToNextMinute = 60_000 - (now % 60_000);

    clearLiveTimers();

    liveAlignTimer = setTimeout(() => {
        setLiveNowSystem(Date.now());

        liveTimer = setInterval(() => {
            setLiveNowSystem(Date.now());
        }, 60_000);
    }, msToNextMinute + 5);
}

/**
 * “пользовательское” изменение выбранного времени (выключает live).
 * Это СЧИТАЕМ действием из глобального пикера/хедера, поэтому игнорируем locked.
 */
export function setSelectedTs(ts: number) {
    // отключаем live и ставим ts
    const gt = get(globalTime);

    clearLiveTimers(); // как stopLive(), но без лишних set’ов

    globalTime.set({
        ...gt,
        live: false,
        ts: ms(ts)
    });
}

export function toggleLive() {
    const gt = get(globalTime);

    if (gt.live) {
        // выключаем live: приземлимся на "сейчас", чтобы не было FUTURE из-за дрейфа
        stopLive();
    } else {
        startLive();
    }
}

/**
 * Замок глобального времени (кнопка в TimePicker).
 * ВАЖНО: он блокирует “внешние” изменения глобального времени (от колёс),
 * но НЕ должен мешать изменению глобального времени из хедера/пикера.
 */
export function setGlobalTimeLocked(next: boolean) {
    globalTime.update((s) => ({ ...s, locked: !!next }));
}

export function toggleGlobalTimeLock() {
    globalTime.update((s) => ({ ...s, locked: !s.locked }));
}
