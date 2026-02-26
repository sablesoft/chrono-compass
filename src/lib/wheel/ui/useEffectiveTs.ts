// src/lib/wheel/ui/useWheelEffectiveTs.ts
import { onDestroy } from 'svelte';
import { writable, type Writable } from 'svelte/store';

import { ms } from '../../format';
import { selectedTs as globalSelectedTs, isLive as globalIsLive } from '../../time/store';
import type { WheelTimeState } from '../types';

type Dbg = { log?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };

export type UseWheelEffectiveTsState = {
    ts: number;
    globalTs: number;
    globalLive: boolean;
    localLiveNowTs: number;
};

export type UseWheelEffectiveTsOpts = {
    syncToBoard?: boolean;
    onSyncTime?: (next: WheelTimeState, reason?: string) => void;
    dbg?: Dbg;
    liveTickMs?: number;
};

export function useWheelEffectiveTs(
    getWheelId: () => string | null | undefined,
    getTime: () => WheelTimeState | null | undefined,
    opts: UseWheelEffectiveTsOpts = {}
) {
    const dbg = opts.dbg ?? {};
    const liveTickMs = opts.liveTickMs ?? 60_000;

    let localLiveNowTs = ms(Date.now());
    let localLiveTimer: ReturnType<typeof setInterval> | null = null;
    let localAlignTimer: ReturnType<typeof setTimeout> | null = null;

    let globalTs = ms(Date.now());
    let globalLive = true;

    const state: Writable<UseWheelEffectiveTsState> = writable({
        ts: ms(Date.now()),
        globalTs,
        globalLive,
        localLiveNowTs,
    });

    function clearLocalLiveTimers() {
        if (localAlignTimer) { clearTimeout(localAlignTimer); localAlignTimer = null; }
        if (localLiveTimer) { clearInterval(localLiveTimer); localLiveTimer = null; }
    }

    function startLocalLiveTicker() {
        clearLocalLiveTimers();
        localLiveNowTs = ms(Date.now());

        const now = Date.now();
        const msToNextTick = liveTickMs - (now % liveTickMs);

        localAlignTimer = setTimeout(() => {
            localLiveNowTs = ms(Date.now());
            localLiveTimer = setInterval(() => {
                localLiveNowTs = ms(Date.now());
                refresh('localLiveTick');
            }, liveTickMs);
        }, msToNextTick + 5);
    }

    function calcEffTs(selectedTs: number, time: WheelTimeState | null | undefined) {
        const t = time ?? { live: true, locked: false };

        if (!t.locked) return selectedTs;
        if (t.live) return localLiveNowTs;

        const fixed = Number((t as any).ts);
        return Number.isFinite(fixed) ? ms(fixed) : selectedTs;
    }

    function refresh(reason = 'refresh') {
        const id = getWheelId?.() ?? null;
        const time = getTime?.() ?? null;

        const needLocalLive = !!time?.locked && !!time?.live;
        if (needLocalLive) {
            if (!localLiveTimer && !localAlignTimer) startLocalLiveTicker();
        } else {
            clearLocalLiveTimers();
        }

        const eff = calcEffTs(globalTs, time);

        state.set({
            ts: ms(eff),
            globalTs,
            globalLive,
            localLiveNowTs,
        });

        if (opts.syncToBoard && time && !time.locked && opts.onSyncTime) {
            const want: WheelTimeState = globalLive
                ? { live: true, locked: false }
                : { live: false, ts: globalTs, locked: false };

            const curLive = !!time.live;
            const curLocked = !!time.locked;
            const curTs = ms(Number((time as any).ts));
            const wantTs = want.live ? curTs : ms(Number((want as any).ts));

            const mismatch =
                curLocked || curLive !== want.live ||
                (!want.live && (!Number.isFinite(curTs) || curTs !== wantTs));

            if (mismatch) {
                try {
                    opts.onSyncTime(want, `useWheelEffectiveTs:${reason}:${id ?? 'noid'}`);
                } catch (e) {
                    dbg.warn?.('useWheelEffectiveTs.onSyncTime failed', e);
                }
            }
        }
    }

    // подписки на global stores
    const unsubGTs = globalSelectedTs.subscribe(v => { globalTs = v; refresh('globalTs'); });
    const unsubGLive = globalIsLive.subscribe(v => { globalLive = v; refresh('globalLive'); });

    // первичный прогон
    refresh('init');

    onDestroy(() => {
        unsubGTs();
        unsubGLive();
        clearLocalLiveTimers();
    });

    return { state, refresh };
}
