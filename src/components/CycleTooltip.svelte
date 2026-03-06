<!-- src/components/CycleTooltip.svelte -->
<script lang="ts">
    import { tick } from 'svelte';
    import { slide } from 'svelte/transition';
    import type { CycleTipPayload } from '../lib/wheel/ui/useCycleTooltip';
    import { formatDateTime } from '../lib/format';
    import { formatLabelTitleCaseUi, formatSpokeCodeUi, formatSpokeTextUi } from '../lib/wheel/types';

    export let x = 0;
    export let y = 0;
    export let payload: CycleTipPayload | null = null;

    export let onPickTs: (ts: number) => void = () => {};
    export let onClose: () => void = () => {};
    export let onEnter: () => void = () => {};
    export let onLeave: () => void = () => {};

    function isFiniteNumber(v: unknown): v is number {
        return typeof v === 'number' && Number.isFinite(v);
    }

    function resolvePickTs(p: CycleTipPayload): number {
        if (p.kind === 'marker') return NaN;
        const v = p.pickTs;
        if (isFiniteNumber(v)) return v;
        return p.ts;
    }

    function titleCaseWords(text: string): string {
        return formatLabelTitleCaseUi(text);
    }

    function normalizeTagLabel(raw: string): string {
        const text = formatSpokeTextUi(String(raw ?? '').trim());
        if (!text) return '';
        // Keep custom labels that already use uppercase/caps as-is.
        if (/[A-Z]/.test(text)) return text;
        return titleCaseWords(text);
    }

    function payloadItems(p: CycleTipPayload | null): Array<{ id?: string; label: string; value?: string; modal?: string }> {
        if (!p || p.kind === 'marker') return [];
        const rows = Array.isArray(p.items) ? p.items : [];
        return rows
            .filter((it) => it && typeof it.label === 'string' && it.label.trim().length > 0)
            .map((it) => ({
                id: it.id,
                label: normalizeTagLabel(it.label),
                value: typeof it.value === 'string' && it.value.trim().length > 0 ? it.value.trim() : undefined,
                modal: typeof it.modal === 'string' && it.modal.trim().length > 0 ? it.modal.trim() : undefined
            }));
    }

    function fmtTs(v: unknown): string {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? formatDateTime(n) : '—';
    }

    function payloadTitle(p: CycleTipPayload | null): string {
        if (!p) return 'Details';
        if (p.kind === 'spoke') return `Spoke ${formatSpokeCodeUi(p.code)}`;
        if (p.kind === 'boundary') return `Boundary ${formatSpokeCodeUi(p.from)}→${formatSpokeCodeUi(p.to)}`;
        return `Marker ${p.label}`;
    }

    function payloadSubtitle(p: CycleTipPayload | null): string {
        if (!p) return '';
        if (p.kind === 'marker') return `${p.moments.length} ${p.moments.length === 1 ? 'moment' : 'moments'}`;
        return '';
    }

    function payloadCopyText(p: CycleTipPayload | null): string {
        if (!p) return '';
        if (p.kind === 'marker') {
            const lines = p.moments
                .map((m) => `${m.emoji ?? '•'} ${m.label} | ${fmtTs(m.ts)}`)
                .join('\n');
            return `${payloadTitle(p)}\n${lines}`;
        }

        const items = payloadItems(p);
        const chunks = [
            payloadTitle(p),
            items.length ? `Items: ${items.map((it) => (it.value ? `${it.label}: ${it.value}` : it.label)).join(', ')}` : '',
        ].filter((x) => x.length > 0);
        return chunks.join(' | ');
    }

    async function copyPayload() {
        const text = payloadCopyText(payload);
        if (!text) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch {}

        if (typeof document === 'undefined') return;
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
    }

    let el: HTMLDivElement | null = null;
    let posX = 0;
    let posY = 0;
    let openItemIndex = -1;
    let tooltipItems: Array<{ id?: string; label: string; value?: string; modal?: string }> = [];
    let tooltipSubtitle = '';
    let prevPayloadRef: CycleTipPayload | null = null;

    const OFFSET = 12;
    const MARGIN = 10;

    async function recomputePosition() {
        await tick();
        if (!el) {
            posX = x + OFFSET;
            posY = y + OFFSET;
            return;
        }

        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let nx = x + OFFSET;
        let ny = y + OFFSET;

        if (nx + r.width + MARGIN > vw) nx = Math.max(MARGIN, vw - r.width - MARGIN);

        if (ny + r.height + MARGIN > vh) {
            const up = y - OFFSET - r.height;
            ny = up >= MARGIN ? up : Math.max(MARGIN, vh - r.height - MARGIN);
        }

        nx = Math.min(Math.max(MARGIN, nx), Math.max(MARGIN, vw - r.width - MARGIN));
        ny = Math.min(Math.max(MARGIN, ny), Math.max(MARGIN, vh - r.height - MARGIN));

        posX = nx;
        posY = ny;
    }

    $: tooltipItems = payloadItems(payload);
    $: tooltipSubtitle = payloadSubtitle(payload);
    $: if (openItemIndex >= tooltipItems.length) openItemIndex = -1;
    $: {
        if (payload !== prevPayloadRef) {
            prevPayloadRef = payload;
            openItemIndex = -1;
        }
    }
    $: void recomputePosition();
    $: if (payload) void recomputePosition();

    function toggleItemAccordion(index: number, modal: string | undefined) {
        if (!modal) return;
        openItemIndex = openItemIndex === index ? -1 : index;
    }
</script>

<div
    class="tip"
    bind:this={el}
    data-tooltip-root="1"
    role="dialog"
    tabindex="-1"
    style={`left:${posX}px; top:${posY}px;`}
    on:mouseenter={onEnter}
    on:mouseleave={onLeave}
>
    {#if payload}
        <header class="head">
            <div class="headLeft">
                <div class="title">{payloadTitle(payload)}</div>
                {#if tooltipSubtitle}
                    <div class="dt">{tooltipSubtitle}</div>
                {/if}
            </div>
            <div class="headRight btnRail">
                {#if payload.kind !== 'marker'}
                    <button
                        class="navBtn miniBtn topIconBtn"
                        type="button"
                        title="Go to this moment"
                        aria-label="Go to this moment"
                        on:click={() => {
                            const t = resolvePickTs(payload);
                            if (isFiniteNumber(t)) onPickTs(t);
                        }}
                    >↪</button>
                {/if}
                <button
                    class="navBtn miniBtn topIconBtn"
                    type="button"
                    title="Copy"
                    aria-label="Copy"
                    on:click={copyPayload}
                >⧉</button>
                <button class="navBtn close topIconBtn" type="button" aria-label="Close" on:click={onClose}>×</button>
            </div>
        </header>

        {#if payload.kind === 'spoke'}
            {#if tooltipItems.length > 0}
                <div class="ui-tag-row">
                    {#each tooltipItems as item, i (`item:${item.id ?? item.label}:${i}`)}
                        {#if item.modal}
                            <button
                                type="button"
                                class="ui-tag chipButton"
                                aria-expanded={openItemIndex === i}
                                on:click={() => toggleItemAccordion(i, item.modal)}
                            >
                                <span class="chipLine">
                                    <span class="chipLabel">{item.label}</span>
                                    {#if item.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{item.value}</span>
                                    {/if}
                                </span>
                            </button>
                        {:else}
                            <span class="ui-tag chipStatic">
                                <span class="chipLine">
                                    <span class="chipLabel">{item.label}</span>
                                    {#if item.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{item.value}</span>
                                    {/if}
                                </span>
                            </span>
                        {/if}
                    {/each}
                </div>
                {@const activeItem = openItemIndex >= 0 ? tooltipItems[openItemIndex] : null}
                {#if activeItem?.modal}
                    <div class="itemAccordion" transition:slide|local={{ duration: 160 }}>
                        <div class="itemAccordionTitle">{activeItem.label}</div>
                        <div class="itemAccordionBody">{activeItem.modal}</div>
                    </div>
                {/if}
            {/if}

        {:else if payload.kind === 'boundary'}
            {#if tooltipItems.length > 0}
                <div class="ui-tag-row">
                    {#each tooltipItems as item, i (`item:${item.id ?? item.label}:${i}`)}
                        {#if item.modal}
                            <button
                                type="button"
                                class="ui-tag chipButton"
                                aria-expanded={openItemIndex === i}
                                on:click={() => toggleItemAccordion(i, item.modal)}
                            >
                                <span class="chipLine">
                                    <span class="chipLabel">{item.label}</span>
                                    {#if item.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{item.value}</span>
                                    {/if}
                                </span>
                            </button>
                        {:else}
                            <span class="ui-tag chipStatic">
                                <span class="chipLine">
                                    <span class="chipLabel">{item.label}</span>
                                    {#if item.value}
                                        <span class="chipDivider" aria-hidden="true"></span>
                                        <span class="chipValue">{item.value}</span>
                                    {/if}
                                </span>
                            </span>
                        {/if}
                    {/each}
                </div>
                {@const activeItem = openItemIndex >= 0 ? tooltipItems[openItemIndex] : null}
                {#if activeItem?.modal}
                    <div class="itemAccordion" transition:slide|local={{ duration: 160 }}>
                        <div class="itemAccordionTitle">{activeItem.label}</div>
                        <div class="itemAccordionBody">{activeItem.modal}</div>
                    </div>
                {/if}
            {/if}

        {:else if payload.kind === 'marker'}
            <div class="list">
                {#each payload.moments as m, i (m.id ?? m.ts ?? i)}
                    <button
                        type="button"
                        class="row"
                        on:click={() => {
                            if (isFiniteNumber(m.ts)) onPickTs(m.ts);
                        }}
                    >
                        <span class="left">
                            <span class="emoji">{m.emoji ?? '•'}</span>
                            <span class="lbl">{m.label}</span>
                        </span>
                        <span class="right">{fmtTs(m.ts)}</span>
                    </button>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .tip {
        position: fixed;
        z-index: 50;
        width: min(420px, calc(100vw - 16px));
        max-height: min(420px, calc(100vh - 16px));
        color: var(--fg);
        background: color-mix(in oklab, var(--bg), black 10%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        border-radius: 14px;
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(8px);
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr;
        padding-bottom: 14px;
    }

    .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
    }

    .headLeft {
        min-width: 0;
        display: grid;
        gap: 2px;
    }

    .title {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .dt {
        font-size: 12px;
        opacity: 0.85;
        font-variant-numeric: tabular-nums;
    }

    .headRight {
        display: flex;
        flex: 0 0 auto;
    }

    .btnRail {
        --seg-size: 34px;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: var(--seg-size);
        border: 1px solid var(--btn-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--btn-bg);
    }

    .btnRail .navBtn {
        width: 100%;
        height: var(--seg-size);
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-right: 1px solid var(--btn-border);
        border-radius: 0;
        background: transparent;
        display: inline-grid;
        place-items: center;
        line-height: 1;
    }

    .btnRail .navBtn:hover:not(:disabled) {
        transform: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
    }

    .btnRail .navBtn:last-child {
        border-right: 0;
    }

    .topIconBtn {
        width: 100%;
        height: 34px;
        padding: 0;
        display: inline-grid;
        place-items: center;
        font-size: 15px;
        line-height: 1;
    }

    .ui-tag-row {
        padding: 10px 12px 0;
    }

    .chipStatic {
        border-color: color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }

    .chipButton {
        cursor: pointer;
        border-color: color-mix(in oklab, var(--accent-blue), transparent 70%);
        background: color-mix(in oklab, var(--accent-blue), transparent 91%);
    }

    .chipButton:hover:not(:disabled) {
        background: color-mix(in oklab, var(--accent-blue), transparent 86%);
        border-color: color-mix(in oklab, var(--accent-blue), transparent 58%);
    }

    .chipLine {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        font-size: 14px;
        font-weight: 700;
        opacity: 0.95;
    }

    .chipLabel {
        opacity: 0.85;
        font-weight: 700;
    }

    .chipDivider {
        width: 1px;
        height: 1.1em;
        background: color-mix(in oklab, var(--fg), transparent 84%);
    }

    .chipValue {
        opacity: 0.98;
        font-weight: 800;
    }

    .itemAccordion {
        margin: 8px 12px 0;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        border-radius: 10px;
        background: color-mix(in oklab, var(--panel), transparent 8%);
        padding: 8px 10px;
        display: grid;
        gap: 6px;
    }

    .itemAccordionTitle {
        font-size: 12px;
        font-weight: 800;
        opacity: 0.86;
        letter-spacing: 0.02em;
    }

    .itemAccordionBody {
        font-size: 13px;
        line-height: 1.35;
        opacity: 0.95;
    }

    .list {
        display: grid;
        gap: 6px;
        margin: 10px 12px 10px;
        overflow: auto;
    }

    .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        color: inherit;
        cursor: pointer;
        text-align: left;
    }

    .row:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .left {
        display: flex;
        gap: 8px;
        align-items: center;
        min-width: 0;
    }

    .emoji {
        width: 18px;
        text-align: center;
    }

    .lbl {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .right {
        white-space: nowrap;
        opacity: 0.9;
        font-variant-numeric: tabular-nums;
    }
</style>
