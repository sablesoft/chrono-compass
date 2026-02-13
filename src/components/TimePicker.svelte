<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';

    import {
        selectedTs as globalSelectedTs,
        isLive as globalIsLive,
        isGlobalTimeLocked,
        setSelectedTs as setGlobalSelectedTs,
        toggleLive as toggleGlobalLive,
        toggleGlobalTimeLock
    } from '../lib/time/store';

    import MomentControl from './MomentControl.svelte';
    import type { WheelTimeState } from '../lib/wheel/types';

    type TimeState = 'LIVE' | 'FUTURE' | 'PAST';

    // ✅ CONTROLLED API (как LocationPicker)
    export let value: WheelTimeState | null = null; // null => global mode
    export let locked = false;

    // ✅ NEW: "тик" для wheel-mode live (когда value.live=true, а value.ts может не меняться)
    export let liveNowTs: number | null = null;

    type ChangeMeta = { lockOnApply?: boolean };
    export let onChange: ((next: { ts: number; live: boolean }, meta: ChangeMeta) => void) | null = null;
    export let onToggleLock: ((next: boolean) => void) | null = null;

    let currentTs = ms(Date.now());
    let live = false;

    let timeState: TimeState = 'PAST';
    let prevLive = false;

    // FUTURE watcher (как было)
    let futureTimer: ReturnType<typeof setInterval> | null = null;
    let futureTargetSec = 0;
    let localNowSec = 0;

    let pickerEl: HTMLInputElement | null = null;

    function clearFutureTimer() {
        if (futureTimer) { clearInterval(futureTimer); futureTimer = null; }
    }

    function toLocalInputValue(ts: number) {
        const d = new Date(ts);
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const y = d.getFullYear();
        const m = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hh = pad2(d.getHours());
        const mm = pad2(d.getMinutes());
        return `${y}-${m}-${day}T${hh}:${mm}`;
    }

    function fromLocalInputValue(v: string) {
        return ms(new Date(v).getTime());
    }

    function startFutureWatcher(targetTs: number) {
        clearFutureTimer();
        futureTargetSec = Math.floor(ms(targetTs) / 1000);
        localNowSec = Math.floor(ms(Date.now()) / 1000);

        if (futureTargetSec <= localNowSec) { timeState = 'PAST'; return; }

        timeState = 'FUTURE';
        futureTimer = setInterval(() => {
            localNowSec += 1;
            if (localNowSec >= futureTargetSec) {
                timeState = 'PAST';
                clearFutureTimer();
            }
        }, 1000);
    }

    function recomputeStateAndTimers() {
        clearFutureTimer();
        if (live) { timeState = 'LIVE'; return; }
        if (currentTs > Date.now()) startFutureWatcher(currentTs);
        else timeState = 'PAST';
    }

    function emitToggleLock(next: boolean) {
        if (onToggleLock) onToggleLock(next);
        else toggleGlobalTimeLock(); // fallback for global mode
    }

    function emitChange(next: { ts: number; live: boolean }) {
        if (onChange) onChange(next, { lockOnApply: value != null });
        else {
            if (next.live) toggleGlobalLive();
            else setGlobalSelectedTs(next.ts);
        }
    }

    function handlePickerInput(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLInputElement)) return;

        const t = fromLocalInputValue(el.value);
        if (!Number.isFinite(t)) return;

        // ✅ любое ручное выставление времени => live=false
        emitChange({ ts: t, live: false });
    }

    function openPicker() {
        if (!pickerEl) return;
        pickerEl.value = toLocalInputValue(currentTs);
        if (typeof (pickerEl as any).showPicker === 'function') (pickerEl as any).showPicker();
        else pickerEl.click();
    }

    function toggleLiveClick(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        emitChange({ ts: currentTs, live: !live });
    }

    function toggleLock(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        emitToggleLock(!locked);
    }

    // ✅ source of truth
    // global mode: подписки на стора
    const unsub1 = globalSelectedTs.subscribe((v: number) => {
        if (value != null) return;
        currentTs = v;
        recomputeStateAndTimers();
    });

    const unsub2 = globalIsLive.subscribe((v: boolean) => {
        if (value != null) return;
        live = v;
        clearFutureTimer();
        recomputeStateAndTimers();
    });

    const unsub3 = isGlobalTimeLocked.subscribe((v: boolean) => {
        if (value != null) return;
        locked = v;
    });

    // wheel mode: реактивно из props
    $: if (value != null) {
        live = !!value.live;
        currentTs = ms((value as any).ts ?? Date.now());
        recomputeStateAndTimers();
    }

    onDestroy(() => {
        unsub1(); unsub2(); unsub3();
        clearFutureTimer();
    });
</script>

<div class="wrap">
    <div class="face">
        <span class="seg state {timeState}">{timeState}</span>

        <span class="seg timeText" title="Selected time">
          {formatDateTime(currentTs)}
        </span>

        <button class="seg iconBtn" type="button" title="Pick date & time" on:click={openPicker}>
            🗓️
        </button>

        <MomentControl buttonClass="seg mc-seg compact" ts={currentTs}/>

        <button
                class="seg nowBtn"
                type="button"
                title={live ? 'Stop live time' : 'Start live time'}
                class:active={live}
                on:click={toggleLiveClick}
        >
            {live ? '⏹' : '▶'}
        </button>

        <button
                class="seg lockBtn ui-lock"
                class:locked={locked}
                type="button"
                on:click={toggleLock}>
            <span class="lockIco" aria-hidden="true">
                {locked ? '🔒' : '🔓'}
            </span>
        </button>

        <input
                bind:this={pickerEl}
                class="hiddenPicker"
                type="datetime-local"
                value={toLocalInputValue(currentTs)}
                on:input={handlePickerInput}
        />
    </div>
</div>

<style>
    .wrap{
        position: relative;
        min-width: 0;
        width: 100%;              /* ✅ */
    }

    .face{
        display: flex;            /* ✅ вместо inline-flex */
        align-items: stretch;
        width: 100%;              /* ✅ растянуть на строку */
        min-width: 0;             /* ✅ чтобы дети могли сжиматься */
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        overflow: hidden;
    }



    /* hover/focus for seg-buttons */
    .face :global(button.seg) {
        border-radius: 0;
        background: transparent;
        outline: none;
        box-shadow: none;
        padding: 6px 8px;
        min-width: 0; /* 🔥 убираем раздувание */
    }

    .face :global(button.seg:hover) {
        outline: none;
        box-shadow: none;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    .face :global(button.seg:focus),
    .face :global(button.seg:focus-visible) {
        outline: none;
        box-shadow: none;
    }

    .seg {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: default;
        user-select: none;
    }

    .seg + .seg {
        border-left: 1px solid var(--btn-border) !important;
    }

    /* компактные фикс-ширины */
    .state {
        width: 72px;
        font-size: 13px;
        font-weight: 1000;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .timeText{
        flex: 1 1 auto;           /* ✅ занимает остаток */
        min-width: 0;             /* ✅ включает ellipsis */
        width: auto;              /* ✅ убираем фикс */
        font-size: 15px;
        font-weight: 850;
        letter-spacing: 0.01em;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .iconBtn {
        width: 40px;
        padding: 0;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
    }

    .nowBtn {
        width: 34px;
        padding: 0;
        font-size: 18px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        background-color: var(--btn-bg) !important;
    }

    .nowBtn.active {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    /* 🔥 MomentControl — принудительно компактный */
    :global(.mc-seg.compact) {
        min-width: 0 !important;
        width: 44px !important;
        padding: 0 !important;
        justify-content: center !important;
    }

    /* если внутри MomentControl есть подписи — прячем (не повредит, если классов нет) */
    :global(.mc-seg.compact .label),
    :global(.mc-seg.compact .text) {
        display: none;
    }

    /* state colors */
    .state.LIVE {
        color: color-mix(in oklab, var(--accent-live), var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-live) 18%);
    }
    .state.FUTURE {
        color: color-mix(in oklab, var(--accent-gold), var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 22%);
    }
    .state.PAST {
        color: color-mix(in oklab, var(--accent-blue), var(--fg) 35%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-blue) 18%);
    }

    /* реально скрытый input, но доступный программно */
    .hiddenPicker {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    @media (max-width: 520px) {
        .state {
            width: 60px;
            font-size: 12px;
        }
        .timeText {
            width: 140px;
            font-size: 14px;
        }
        .iconBtn {
            width: 36px;
        }
        :global(.mc-seg.compact) {
            width: 40px !important;
        }
    }
</style>