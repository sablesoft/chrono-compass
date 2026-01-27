<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';
    import { selectedTs, isLive, setSelectedTs, toggleLive } from '../lib/stores/time';

    let open = false;
    let draft = '';

    // store values (subscribed manually)
    let currentTs = ms(Date.now());
    let live = false;

    // real "now" ticker for badge (keeps FUTURE/PAST updating)
    let nowTs = ms(Date.now());
    let nowTimer: ReturnType<typeof setInterval> | null = null;

    const unsub1 = selectedTs.subscribe((v) => {
        currentTs = ms(v);
        if (!open) draft = toLocalInputValue(currentTs);
    });

    const unsub2 = isLive.subscribe((v) => (live = v));

    onMount(() => {
        // update "now" periodically (lightweight). 1s feels snappy; can be 10s if you want.
        nowTimer = setInterval(() => {
            nowTs = ms(Date.now());
        }, 1000);
    });

    onDestroy(() => {
        unsub1();
        unsub2();
        if (nowTimer) clearInterval(nowTimer);
    });

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

    // Badge: LIVE / PAST / FUTURE (stable, no jitter)
    const NOW_EPS = 60_000; // 1 minute tolerance
    $: timeState = live ? 'LIVE' : (currentTs < (nowTs - NOW_EPS) ? 'PAST' : 'FUTURE');

    function toggle() {
        open = !open;
        if (open) draft = toLocalInputValue(currentTs);
    }

    function apply() {
        const t = fromLocalInputValue(draft);
        if (Number.isFinite(t)) setSelectedTs(t); // should turn live off inside the store action
        open = false;
    }

    function close() {
        open = false;
    }

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

    <div class="timeGroup">
        <span class="seg state {timeState}">
            {timeState}
        </span>
        <button
                class="seg timeBtn"
                type="button"
                on:click={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
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
    .wrap { position: relative; min-width: 0; }
    .timeGroup{
        display: inline-flex;
        align-items: stretch;

        border-radius: 14px;
        overflow: hidden;

        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
    }
    .seg{
        display:flex;
        align-items:center;
        justify-content:center;

        height: 44px;
        padding: 0 14px;

        font-size: 16px;
        border: 0;
        background: transparent;
        color: inherit;

        white-space: nowrap;
    }
    .timeGroup .seg{
        border-radius: 0 !important;
    }

    /* вертикальные разделители */
    .seg + .seg{
        border-left: 1px solid var(--btn-border);
    }
    /* STATE: LIVE / PAST / FUTURE */
    .seg.state{
        width: 90px;
        font-size: 18px;
        font-weight: 1000;
        letter-spacing: .14em;
    }

    /* TIME */
    .seg.timeBtn{
        width: 260px;
        font-size: 20px;
        font-weight: 850;
        letter-spacing: .02em;
        cursor: pointer;
    }

    /* NOW / STOP */
    .seg.nowBtn{
        width: 86px;
        font-size: 20px;
        font-weight: 800;
        cursor: pointer;
    }
    /* LIVE */
    .seg.state.LIVE{
        color: color-mix(in oklab, #00ff9c, var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), #00ff9c 18%);
    }

    /* PAST — синий */
    .seg.state.PAST{
        color: color-mix(in oklab, var(--accent-blue), var(--fg) 35%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-blue) 18%);
    }

    /* FUTURE — золото */
    .seg.state.FUTURE{
        color: color-mix(in oklab, var(--accent-gold), var(--fg) 30%);
        background: color-mix(in oklab, var(--btn-bg), var(--accent-gold) 22%);
    }
    .nowBtn{
        margin-left: 2px;
        font-size: 16px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
    }
    .seg.nowBtn.active{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
    }

    .pop{
        position:absolute;
        top: calc(100% + 10px);
        right: 0;
        z-index: 50;
        width: 360px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        padding: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-size: 16px;
    }

    .row{ display:grid; gap: 10px; }
    .hint{
        font-size: 14px;
        font-weight: 800;
        opacity: 0.9;
        letter-spacing: .02em;
    }

    input{
        font-size: 16px;
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
        .pop{ width: min(360px, calc(100vw - 32px)); }
    }
</style>
