<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';
    import { selectedTs, isLive, setSelectedTs, toggleLive } from '../lib/stores/time';

    type TimeState = 'LIVE' | 'FUTURE' | 'PAST';

    let currentTs = ms(Date.now());
    let live = false;

    let timeState: TimeState = 'PAST';
    let prevLive = false;

    // FUTURE watcher
    let futureTimer: ReturnType<typeof setInterval> | null = null;
    let futureTargetSec = 0;
    let localNowSec = 0;

    let pickerEl: HTMLInputElement | null = null;

    function clearFutureTimer() {
        if (futureTimer) {
            clearInterval(futureTimer);
            futureTimer = null;
        }
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

        if (futureTargetSec <= localNowSec) {
            timeState = 'PAST';
            return;
        }

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

        if (live) {
            timeState = 'LIVE';
            return;
        }

        // not live
        if (currentTs > Date.now()) startFutureWatcher(currentTs);
        else timeState = 'PAST';
    }

    function handlePickerInput(e: Event) {
        const el = e.currentTarget as HTMLInputElement;
        const t = fromLocalInputValue(el.value);
        if (Number.isFinite(t)) setSelectedTs(t);
    }

    function openPicker() {
        if (!pickerEl) return;

        // держим value синхронным, чтобы при открытии показывало текущий момент
        pickerEl.value = toLocalInputValue(currentTs);

        // Chrome/Edge/Safari (частично): нативный вызов
        // @ts-expect-error showPicker not in TS lib
        if (typeof pickerEl.showPicker === 'function') pickerEl.showPicker();
        else pickerEl.click();
    }

    const unsub1 = selectedTs.subscribe((v) => {
        currentTs = v;
        recomputeStateAndTimers();
    });

    const unsub2 = isLive.subscribe((v) => {
        live = v;

        // LIVE -> not LIVE: мгновенно PAST
        if (prevLive && !live) {
            clearFutureTimer();
            timeState = 'PAST';
        } else {
            recomputeStateAndTimers();
        }

        prevLive = live;
    });

    onDestroy(() => {
        unsub1();
        unsub2();
        clearFutureTimer();
    });
</script>

<div class="wrap">
    <div class="face">
        <span class="seg state {timeState}">{timeState}</span>

        <span class="seg timeText" title="Selected time">
          {formatDateTime(currentTs)}
        </span>

        <!-- маленькая кнопка-иконка для открытия нативного пикера -->
        <button class="seg iconBtn" type="button" title="Pick date & time" on:click={openPicker}>
            🗓️
        </button>

        <button
                class="seg nowBtn"
                type="button"
                title={live ? 'Stop live time' : 'Jump to now'}
                class:active={live}
                on:click={toggleLive}
        >
            {live ? 'Stop' : 'Now'}
        </button>

        <!-- скрытый input: изменения сразу применяются -->
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
    .wrap { position: relative; min-width: 0; margin-right: 20px; }

    .face{
        display: inline-flex;
        align-items: stretch;
        border-radius: 14px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        overflow: hidden;
    }

    .seg{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: default;
        user-select: none;
    }

    .seg + .seg{
        border-left: 1px solid var(--btn-border);
    }

    /* fixed widths */
    .state{
        width: 96px;
        font-size: 16px;
        font-weight: 1000;
        letter-spacing: .10em;
        text-transform: uppercase;
    }

    .timeText{
        width: 250px; /* фикс */
        font-size: 20px;
        font-weight: 900;
        letter-spacing: .02em;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .iconBtn{
        width: 56px;  /* фикс */
        cursor: pointer;
        font-size: 20px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }

    .nowBtn{
        width: 96px;
        font-size: 20px;
        font-weight: 800;
        cursor: pointer;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }

    .nowBtn.active{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
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
    .hiddenPicker{
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    @media (max-width: 520px){
        .timeText{ width: 170px; }
    }
</style>