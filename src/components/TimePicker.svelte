<!-- src/components/TimePicker.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { formatDateTime, ms } from '../lib/format';
    import { selectedTs, isLive, setSelectedTs, toggleLive } from '../lib/stores/time';

    let open = false;
    let draft = '';

    let currentTs = ms(Date.now());
    let live = false;

    const unsub1 = selectedTs.subscribe((v) => {
        currentTs = v;
        if (!open) draft = toLocalInputValue(v);
    });

    const unsub2 = isLive.subscribe((v) => (live = v));

    onDestroy(() => { unsub1(); unsub2(); });

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

    function toggle() {
        open = !open;
        if (open) draft = toLocalInputValue(currentTs);
    }

    function apply() {
        const t = fromLocalInputValue(draft);
        if (Number.isFinite(t)) setSelectedTs(t); // user => выключит live
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
    <div class="face">
        <button class="timeBtn" type="button" on:click={toggle} aria-haspopup="dialog" aria-expanded={open}>
            {formatDateTime(currentTs)}
        </button>

        {#if live}
            <span class="live">LIVE</span>
        {/if}

        <button class="nowBtn" type="button" class:active={live} on:click={toggleLive}>
            Now
        </button>
    </div>

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

        <button class="backdrop" type="button" aria-label="Close time picker" on:click={close} tabindex="-1" />
    {/if}
</div>

<style>
    .wrap { position: relative; min-width: 0; }

    .face{
        display:flex;
        align-items:center;
        gap: 10px;
        min-width: 0;
    }

    .timeBtn{
        font-size: 20px;
        font-weight: 850;
        letter-spacing: .02em;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        white-space: nowrap;
    }

    .live{
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .08em;
        opacity: .75;
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
    .nowBtn.active{
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
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
