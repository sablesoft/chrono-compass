<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';
    import { clampTsToWheelTimeframe, resolveWheelTimeframeBounds } from '../lib/wheel/timeframe';

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

    // FUTURE watcher (как было)
    let futureTimer: ReturnType<typeof setInterval> | null = null;
    let futureTargetSec = 0;
    let localNowSec = 0;

    let pickerEl: HTMLInputElement | null = null;
    let showActions = false;
    let pickerMinValue = '';
    let pickerMaxValue = '';

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

    function toNativeLocalInputValue(ts: number): string {
        const d = new Date(ts);
        const y = d.getFullYear();
        if (!Number.isFinite(y) || y < 0 || y > 9999) return '';
        return toLocalInputValue(ts);
    }

    function toExtendedLocalInputValue(ts: number): string {
        const d = new Date(ts);
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const y = d.getFullYear();
        const year = y < 0 ? `-${String(Math.abs(y)).padStart(4, '0')}` : String(y).padStart(4, '0');
        const m = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hh = pad2(d.getHours());
        const mm = pad2(d.getMinutes());
        return `${year}-${m}-${day}T${hh}:${mm}`;
    }

    function parseExtendedLocalInputValue(v: string): number {
        const re = /^([+-]?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
        const m = re.exec(String(v).trim());
        if (!m) return NaN;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const hour = Number(m[4]);
        const minute = Number(m[5]);
        const second = m[6] ? Number(m[6]) : 0;
        const millis = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
        if (![year, month, day, hour, minute, second, millis].every(Number.isFinite)) return NaN;
        if (month < 1 || month > 12) return NaN;
        if (day < 1 || day > 31) return NaN;
        if (hour < 0 || hour > 23) return NaN;
        if (minute < 0 || minute > 59) return NaN;
        if (second < 0 || second > 59) return NaN;
        if (millis < 0 || millis > 999) return NaN;

        const d = new Date(0);
        d.setFullYear(year, month - 1, day);
        d.setHours(hour, minute, second, millis);
        if (
            d.getFullYear() !== year ||
            d.getMonth() !== (month - 1) ||
            d.getDate() !== day ||
            d.getHours() !== hour ||
            d.getMinutes() !== minute ||
            d.getSeconds() !== second ||
            d.getMilliseconds() !== millis
        ) return NaN;
        return ms(d.getTime());
    }

    function fromLocalInputValue(v: string) {
        const ext = parseExtendedLocalInputValue(v);
        if (Number.isFinite(ext)) return ext;
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

    function timeStateBadgeLabel(state: TimeState): string {
        if (state === 'LIVE') return 'Now';
        if (state === 'FUTURE') return 'Fut';
        return 'Past';
    }

    function emitToggleLock(next: boolean) {
        if (onToggleLock) onToggleLock(next);
        else toggleGlobalTimeLock(); // fallback for global mode
    }

    function emitChange(next: { ts: number; live: boolean }) {
        const safeNext = next.live
            ? next
            : { ...next, ts: ms(clampTsToWheelTimeframe(next.ts)) };
        if (onChange) onChange(safeNext, { lockOnApply: value != null });
        else {
            if (safeNext.live) toggleGlobalLive();
            else setGlobalSelectedTs(safeNext.ts);
        }
    }

    function handlePickerInput(e: Event) {
        const el = e.currentTarget;
        if (!(el instanceof HTMLInputElement)) return;

        const t = fromLocalInputValue(el.value);
        if (!Number.isFinite(t)) return;

        // ✅ любое ручное выставление времени => live=false
        emitChange({ ts: ms(clampTsToWheelTimeframe(t)), live: false });
    }

    function openPicker() {
        if (!pickerEl) return;
        pickerEl.value = toNativeLocalInputValue(currentTs);
        if (typeof (pickerEl as any).showPicker === 'function') (pickerEl as any).showPicker();
        else pickerEl.click();
        showActions = false;
    }

    function openExtendedPicker() {
        const preset = toExtendedLocalInputValue(currentTs);
        const raw = window.prompt('Enter date-time (extended ISO local): YYYY-MM-DDTHH:mm or -YYYYY-MM-DDTHH:mm', preset);
        if (raw == null) return;
        const t = parseExtendedLocalInputValue(raw);
        if (!Number.isFinite(t)) return;
        emitChange({ ts: ms(clampTsToWheelTimeframe(t)), live: false });
        showActions = false;
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

    function toggleActionsPanel(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        showActions = !showActions;
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
        const liveTs = liveNowTs;
        currentTs = live && liveTs !== null && Number.isFinite(liveTs)
            ? ms(liveTs)
            : ms((value as any).ts ?? Date.now());
        recomputeStateAndTimers();
    }
    $: {
        const bounds = resolveWheelTimeframeBounds();
        const minTs = bounds?.minTs;
        const maxTs = bounds?.maxTs;
        pickerMinValue = Number.isFinite(minTs) ? toNativeLocalInputValue(minTs as number) : '';
        pickerMaxValue = Number.isFinite(maxTs) ? toNativeLocalInputValue(maxTs as number) : '';
    }

    onDestroy(() => {
        unsub1(); unsub2(); unsub3();
        clearFutureTimer();
    });
</script>

<div class="wrap">
    <div class="face">
        <span
                class="seg state"
                class:time-tone-now={timeState === 'LIVE'}
                class:time-tone-future={timeState === 'FUTURE'}
                class:time-tone-past={timeState === 'PAST'}
                title={timeState}
        >{timeStateBadgeLabel(timeState)}</span>

        <button
                class="seg timeText timeTextBtn"
                type="button"
                title="Selected time (click to toggle actions)"
                on:click={toggleActionsPanel}
        >
            {formatDateTime(currentTs)}
        </button>

        {#if showActions}
            <button class="seg iconBtn" type="button" title="Pick date & time" on:click={openPicker}>
                🗓️
            </button>
            <button class="seg iconBtn" type="button" title="Set extended year date-time" on:click={openExtendedPicker}>
                ±
            </button>
            <!-- TODO: Re-enable moment save control when save-moment flow is implemented. -->
            {#if false}
                <MomentControl buttonClass="seg mc-seg compact" ts={currentTs}/>
            {/if}
        {/if}

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
                class="navBtn ui-lock"
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
                value={toNativeLocalInputValue(currentTs)}
                min={pickerMinValue}
                max={pickerMaxValue}
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
        border-radius: var(--radius-12);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--fg), transparent 93%);
        overflow: hidden;
    }



    /* hover/focus for seg-buttons */
    .face :global(button.seg) {
        border-radius: 0;
        background: transparent;
        outline: none;
        box-shadow: none;
        padding: var(--sp-6) var(--sp-8);
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
        width: 54px;
        font-size: var(--fs-11);
        font-weight: 1000;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    .timeText{
        flex: 1 1 auto;           /* ✅ занимает остаток */
        min-width: 0;             /* ✅ включает ellipsis */
        width: auto;              /* ✅ убираем фикс */
        font-size: var(--fs-13);
        font-weight: 850;
        letter-spacing: 0.01em;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .timeTextBtn {
        cursor: pointer;
        text-align: left;
    }

    .iconBtn {
        width: 36px;
        padding: 0;
        cursor: pointer;
        font-size: var(--fs-16);
        line-height: 1;
    }

    .nowBtn {
        width: 30px;
        padding: 0;
        font-size: var(--fs-16);
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        background-color: var(--btn-bg) !important;
    }

    .nowBtn.active {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    .ui-lock {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        min-width: 34px;
        margin: 0 !important;
        padding: 0 var(--sp-8) !important;
        border: 0 !important;
        border-left: 1px solid var(--btn-border) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
    }
    .ui-lock:hover:not(:disabled) {
        transform: none !important;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%) !important;
    }

    /* 🔥 MomentControl — принудительно компактный */
    /*noinspection CssUnusedSymbol*/
    :global(.mc-seg.compact) {
        min-width: 0 !important;
        width: 44px !important;
        padding: 0 !important;
        justify-content: center !important;
    }

    /* если внутри MomentControl есть подписи — прячем (не повредит, если классов нет) */
    /*noinspection CssUnusedSymbol*/
    :global(.mc-seg.compact .label),
    :global(.mc-seg.compact .text) {
        display: none;
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
            width: 48px;
            font-size: var(--fs-10);
        }
        .timeText {
            width: 140px;
            font-size: var(--fs-12);
        }
        .iconBtn {
            width: 32px;
        }
        /*noinspection CssUnusedSymbol*/
        :global(.mc-seg.compact) {
            width: 36px !important;
        }
    }
</style>
