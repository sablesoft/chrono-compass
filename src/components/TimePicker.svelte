<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';
    import { selectedTs, isLive, setSelectedTs, toggleLive } from '../lib/stores/time';

    type TimeState = 'LIVE' | 'FUTURE' | 'PAST';

    let open = false;
    let draft = '';

    let currentTs = ms(Date.now());
    let live = false;

    // локальная машина состояний для бейджа
    let timeState: TimeState = 'PAST';

    // следим за переходом LIVE -> not LIVE, чтобы "Stop => PAST" всегда мгновенно
    let prevLive = false;

    // FUTURE watcher timer (только когда реально нужен)
    let futureTimer: ReturnType<typeof setInterval> | null = null;
    let futureTargetSec = 0;
    let localNowSec = 0;

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

    function computeStateFromTs(ts: number) {
        if (live) return 'LIVE' as const;
        const now = Date.now();
        return ts > now ? ('FUTURE' as const) : ('PAST' as const);
    }

    function startFutureWatcher(targetTs: number) {
        clearFutureTimer();

        futureTargetSec = Math.floor(ms(targetTs) / 1000);
        localNowSec = Math.floor(ms(Date.now()) / 1000);

        // если уже не будущее — не запускаем
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

        // если не live — FUTURE нуждается в watch-таймере, PAST нет
        const now = Date.now();
        if (currentTs > now) {
            startFutureWatcher(currentTs);
        } else {
            timeState = 'PAST';
        }
    }

    // подписки на store
    const unsub1 = selectedTs.subscribe((v) => {
        currentTs = ms(v);
        if (!open) draft = toLocalInputValue(currentTs);

        // любое изменение выбранного момента пересобирает FUTURE-таймер (если нужно)
        recomputeStateAndTimers();
    });

    const unsub2 = isLive.subscribe((v) => {
        live = v;

        // переход LIVE -> not LIVE (кнопка Stop): моментально PAST и никаких таймеров
        if (prevLive && !live) {
            clearFutureTimer();
            timeState = 'PAST';
        } else {
            // остальные случаи: обычная логика
            recomputeStateAndTimers();
        }

        prevLive = live;
    });

    onDestroy(() => {
        unsub1();
        unsub2();
        clearFutureTimer();
    });

    function toggle() {
        open = !open;
        if (open) draft = toLocalInputValue(currentTs);
    }

    function apply() {
        const t = fromLocalInputValue(draft);
        if (Number.isFinite(t)) setSelectedTs(t); // user => выключит live (в сторе)
        open = false;
    }

    function close() { open = false; }

    function onKey(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') close();
        if (e.key === 'Enter') apply();
    }
</script>

<div class="wrap" on:keydown={onKey}>
    {#if open}
        <div class="pop" role="dialog" aria-label="Pick date and time">
            <div class="row">
                <div class="hint">Pick date &amp; time</div>
                <input type="datetime-local" bind:value={draft} />
            </div>

            <div class="btns">
                <button type="button" on:click={close}>Cancel</button>
                <button type="button" class="primary" on:click={apply}>Apply</button>
            </div>
        </div>

        <button
                class="backdrop"
                type="button"
                aria-label="Close time picker"
                on:click={close}
                tabindex="-1"
        />
    {/if}

    <!-- unified block -->
    <div class="face">
        <span class="seg state {timeState}">
          {timeState}
        </span>
        <button
                class="seg timeBtn"
                type="button"
                on:click={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                title="Pick date & time"
        >
            {formatDateTime(currentTs)}
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
    </div>
</div>

<style>
    .wrap {
        position: relative; min-width: 0;
        margin-right: 20px;
    }

    /* unified block */
    .face{
        display: inline-flex;
        align-items: stretch;
        border-radius: 14px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        overflow: hidden; /* важно: чтобы внутри не было "скруглений" */
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
    }

    /* vertical dividers */
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
        cursor: default;
        user-select: none;
    }

    .timeBtn{
        width: 260px;
        justify-content: center;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: .02em;
        white-space: nowrap;
        cursor: pointer;
    }

    .nowBtn{
        width: 96px;
        font-size: 20px;
        font-weight: 800;
        cursor: pointer;
    }

    .nowBtn.active{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
    }

    /* state colors */
    .state.LIVE {
        color: color-mix(in oklab, #00ff9c, var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), #00ff9c 18%);
    }
    .state.FUTURE {
        color: color-mix(in oklab, var(--accent-gold), var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 22%);
    }
    .state.PAST {
        color: color-mix(in oklab, var(--accent-blue), var(--fg) 35%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-blue) 18%);
    }

    /* popup */
    .pop{
        position:absolute;
        top: calc(100% + 10px);
        right: 0;
        z-index: 50;
        width: 450px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-size: 16px;
    }

    .row{ display:grid; gap: 12px; }
    .hint{
        font-size: 16px;
        font-weight: 900;
        opacity: 0.95;
        letter-spacing: .02em;
    }

    input{
        font-size: 18px;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid var(--input-border);
        background: var(--input-bg);
        color: inherit;
        outline: none;
    }

    .btns{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top: 14px;
    }

    .btns button{
        font-size: 16px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
    }

    button.primary{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 14%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
    }

    .backdrop{
        position: fixed;
        inset: 0;
        z-index: 40;
        background: transparent;
        border: 0;
        padding: 0;
    }

    @media (max-width: 520px){
        .pop{ width: min(380px, calc(100vw - 32px)); }
        .timeBtn{ width: 220px; }
    }
</style>