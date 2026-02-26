<!-- src/components/CycleTooltip.svelte -->
<script lang="ts">
    import { tick } from 'svelte';
    import type { CycleTipPayload } from '../lib/wheel/ui/useCycleTooltip';
    import { formatDateTime } from '../lib/format';

    export let x = 0;
    export let y = 0;
    export let payload: CycleTipPayload | null = null;

    export let onPickTs: (ts: number) => void = () => {};
    export let onClose: () => void = () => {};

    // NEW: allow parent to keep tooltip open while hovering it
    export let onEnter: () => void = () => {};
    export let onLeave: () => void = () => {};

    function isFiniteNumber(v: any): v is number {
        return typeof v === 'number' && Number.isFinite(v);
    }

    // Patch 2: do not format junk as date
    function fmtTs(v: any): string {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? formatDateTime(n) : '—';
    }

    function formatKm(km: number) {
        if (!isFiniteNumber(km)) return '—';
        if (km >= 1e9) return `${(km / 1e9).toFixed(2)}B km`;
        if (km >= 1e6) return `${(km / 1e6).toFixed(2)}M km`;
        if (km >= 1e3) return `${(km / 1e3).toFixed(1)}k km`;
        return `${Math.round(km)} km`;
    }

    function formatAu(au: number) {
        if (!isFiniteNumber(au)) return '—';
        return `${au.toFixed(3)} AU`;
    }

    // “общий” рендер меты: сначала known-кейсы, потом fallback
    function renderMetaLines(meta: any): Array<{ k: string; v: string }> {
        if (!meta) return [];

        // BindMeta
        if (isFiniteNumber((meta as any).distanceKm) || isFiniteNumber((meta as any).distanceAu)) {
            return [
                ...(isFiniteNumber((meta as any).distanceAu) ? [{ k: 'Distance', v: formatAu((meta as any).distanceAu) }] : []),
                ...(isFiniteNumber((meta as any).distanceKm) ? [{ k: ' ', v: formatKm((meta as any).distanceKm) }] : []),
            ];
        }

        // fallback: плоские примитивы
        if (typeof meta === 'object' && meta) {
            const out: Array<{ k: string; v: string }> = [];
            for (const [k, v] of Object.entries(meta)) {
                if (v == null) continue;
                if (typeof v === 'number') out.push({ k, v: String(v) });
                else if (typeof v === 'string' || typeof v === 'boolean') out.push({ k, v: String(v) });
            }
            return out.slice(0, 8);
        }

        return [];
    }

    // --- NEW: viewport clamping (prevent going off-screen) ---
    let el: HTMLDivElement | null = null;
    let posX = 0;
    let posY = 0;

    const OFFSET = 12; // cursor offset
    const MARGIN = 10; // viewport margin

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

        // default: show to the bottom-right of cursor
        let nx = x + OFFSET;
        let ny = y + OFFSET;

        // clamp right
        if (nx + r.width + MARGIN > vw) nx = Math.max(MARGIN, vw - r.width - MARGIN);

        // clamp bottom: try above cursor first
        if (ny + r.height + MARGIN > vh) {
            const up = y - OFFSET - r.height;
            ny = up >= MARGIN ? up : Math.max(MARGIN, vh - r.height - MARGIN);
        }

        // final clamp
        nx = Math.min(Math.max(MARGIN, nx), Math.max(MARGIN, vw - r.width - MARGIN));
        ny = Math.min(Math.max(MARGIN, ny), Math.max(MARGIN, vh - r.height - MARGIN));

        posX = nx;
        posY = ny;
    }

    // react to movement and content changes (content affects size)
    $: void recomputePosition();
    $: if (payload) void recomputePosition();
</script>

<div
        class="root"
        bind:this={el}
        data-tooltip-root="1"
        style={`left:${posX}px; top:${posY}px;`}
        on:mouseenter={onEnter}
        on:mouseleave={onLeave}
>
    {#if payload}
        {#if payload.kind === 'spoke'}
            <div class="title">Spoke <span class="chip">{payload.code}</span></div>
            <div class="dt">{fmtTs(payload.ts)}</div>

            {#each renderMetaLines(payload.meta) as row (row.k + row.v)}
                <div class="metaRow">
                    <span class="k">{row.k}</span>
                    <span class="v">{row.v}</span>
                </div>
            {/each}

            <div class="actions">
                <button type="button" class="btn" on:click={() => isFiniteNumber(payload.ts) && onPickTs(payload.ts)}>Go</button>
                <button type="button" class="btn ghost" on:click={onClose}>Close</button>
            </div>

        {:else if payload.kind === 'boundary'}
            <div class="title">Boundary <span class="chip">{payload.from}→{payload.to}</span></div>
            <div class="dt">{fmtTs(payload.ts)}</div>

            {#each renderMetaLines(payload.meta) as row (row.k + row.v)}
                <div class="metaRow">
                    <span class="k">{row.k}</span>
                    <span class="v">{row.v}</span>
                </div>
            {/each}

            <div class="actions">
                <button type="button" class="btn" on:click={() => isFiniteNumber(payload.ts) && onPickTs(payload.ts)}>Go</button>
                <button type="button" class="btn ghost" on:click={onClose}>Close</button>
            </div>

        {:else if payload.kind === 'marker'}
            <div class="title">Marker <span class="chip">{payload.label}</span></div>

            <div class="list">
                {#each payload.moments as m, i (m.id ?? m.ts ?? i)}
                    <button type="button" class="row" on:click={() => isFiniteNumber(m.ts) && onPickTs(m.ts)}>
            <span class="left">
              <span class="emoji">{m.emoji ?? '•'}</span>
              <span class="lbl">{m.label}</span>
            </span>
                        <span class="right">{fmtTs(m.ts)}</span>
                    </button>
                {/each}
            </div>

            <div class="actions">
                <button type="button" class="btn ghost" on:click={onClose}>Close</button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .root{
        position: fixed;
        z-index: 9999;
        min-width: 240px;
        max-width: 360px;
        padding: 10px 12px;
        border-radius: 12px;
        background: color-mix(in oklab, var(--panel), black 12%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        backdrop-filter: blur(8px);
    }
    .title{ font-weight: 850; display:flex; gap:8px; align-items:center; }
    .chip{
        font-weight: 800;
        font-size: 0.85em;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        opacity: 0.9;
    }
    .dt{ margin-top: 6px; opacity: 0.9; font-variant-numeric: tabular-nums; }
    .metaRow{ display:flex; justify-content: space-between; gap: 12px; margin-top: 6px; opacity:0.85; }
    .metaRow .k{ opacity:0.7; }
    .metaRow .v{ font-variant-numeric: tabular-nums; }

    .actions{ display:flex; gap:8px; justify-content:flex-end; margin-top: 10px; }
    .btn{
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-weight: 800;
    }
    .btn.ghost{
        background: transparent;
        opacity: 0.85;
    }

    .list{ display:grid; gap:6px; margin-top: 10px; }
    .row{
        display:flex;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.03);
        color: inherit;
        cursor: pointer;
        text-align:left;
    }
    .row:hover{ background: rgba(255,255,255,0.06); }
    .left{ display:flex; gap:8px; align-items:center; min-width:0; }
    .emoji{ width: 18px; text-align:center; }
    .lbl{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .right{ white-space:nowrap; opacity:0.9; font-variant-numeric: tabular-nums; }
</style>
