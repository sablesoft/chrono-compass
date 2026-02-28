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
        return text
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function payloadTags(p: CycleTipPayload | null): string[] {
        if (!p || p.kind === 'marker') return [];
        const tags: unknown[] = Array.isArray(p.tags) ? p.tags : [];
        const normalized = tags
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => titleCaseWords(t.trim()));
        return Array.from(new Set(normalized));
    }

    function fmtTs(v: unknown): string {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? formatDateTime(n) : '—';
    }

    function formatKm(km: number): string {
        if (!isFiniteNumber(km)) return '—';
        const abs = Math.abs(km);
        if (abs >= 1e12) return `${(km / 1e12).toFixed(3)} Tkm`;
        if (abs >= 1e9) return `${(km / 1e9).toFixed(3)} Bkm`;
        if (abs >= 1e6) return `${(km / 1e6).toFixed(3)} Mkm`;
        if (abs >= 1e3) return `${(km / 1e3).toFixed(3)} Kkm`;
        return `${km.toFixed(3)} km`;
    }

    function formatAu(au: number): string {
        if (!isFiniteNumber(au)) return '—';
        return `${au.toFixed(3)} AU`;
    }

    function formatDeg(v: number): string {
        if (!isFiniteNumber(v)) return '—';
        return `${v.toFixed(1)}°`;
    }

    function formatDeg3(v: number): string {
        if (!isFiniteNumber(v)) return '—';
        return `${v.toFixed(3)}°`;
    }

    function formatNum3(v: number): string {
        if (!isFiniteNumber(v)) return '—';
        return v.toFixed(3);
    }

    function formatHours(v: number): string {
        if (!isFiniteNumber(v)) return '—';
        return `${v.toFixed(3)}h`;
    }

    function renderMetaLines(meta: any): Array<{ k: string; v: string }> {
        if (!meta) return [];

        if (isFiniteNumber((meta as any).altitudeDeg) || isFiniteNumber((meta as any).azimuthDeg)) {
            return [
                ...(isFiniteNumber((meta as any).altitudeDeg)
                    ? [{ k: 'Alt', v: formatDeg((meta as any).altitudeDeg) }]
                    : []),
                ...(isFiniteNumber((meta as any).azimuthDeg)
                    ? [{ k: 'Az', v: formatDeg((meta as any).azimuthDeg) }]
                    : []),
                ...(isFiniteNumber((meta as any).raHours)
                    ? [{ k: 'RA', v: formatHours((meta as any).raHours) }]
                    : []),
                ...(isFiniteNumber((meta as any).decDeg)
                    ? [{ k: 'Dec', v: formatDeg((meta as any).decDeg) }]
                    : []),
                ...(isFiniteNumber((meta as any).distanceAu)
                    ? [{ k: 'Distance', v: formatAu((meta as any).distanceAu) }]
                    : []),
                ...(isFiniteNumber((meta as any).distanceKm)
                    ? [{ k: ' ', v: formatKm((meta as any).distanceKm) }]
                    : []),
            ];
        }

        if (isFiniteNumber((meta as any).nodalLatitudeDeg)) {
            return [
                { k: 'Nodal Lat', v: formatDeg3((meta as any).nodalLatitudeDeg) },
                ...(isFiniteNumber((meta as any).targetDistanceAu)
                    ? [{ k: 'Dist AU', v: formatNum3((meta as any).targetDistanceAu) }]
                    : []),
                ...(isFiniteNumber((meta as any).targetDistanceKm)
                    ? [{ k: 'Dist km', v: formatKm((meta as any).targetDistanceKm) }]
                    : []),
            ];
        }

        if (isFiniteNumber((meta as any).distanceKm) || isFiniteNumber((meta as any).distanceAu)) {
            return [
                ...(isFiniteNumber((meta as any).distanceAu) ? [{ k: 'Distance', v: formatAu((meta as any).distanceAu) }] : []),
                ...(isFiniteNumber((meta as any).distanceKm) ? [{ k: ' ', v: formatKm((meta as any).distanceKm) }] : []),
            ];
        }

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

    function payloadTitle(p: CycleTipPayload | null): string {
        if (!p) return 'Details';
        if (p.kind === 'spoke') return `Spoke ${p.code}`;
        if (p.kind === 'boundary') return `Boundary ${p.from}→${p.to}`;
        return `Marker ${p.label}`;
    }

    function payloadSubtitle(p: CycleTipPayload | null): string {
        if (!p) return '';
        if (p.kind === 'marker') return `${p.moments.length} ${p.moments.length === 1 ? 'moment' : 'moments'}`;
        return fmtTs(p.ts);
    }

    function payloadCopyText(p: CycleTipPayload | null): string {
        if (!p) return '';
        if (p.kind === 'marker') {
            const lines = p.moments
                .map((m) => `${m.emoji ?? '•'} ${m.label} | ${fmtTs(m.ts)}`)
                .join('\n');
            return `${payloadTitle(p)}\n${lines}`;
        }

        const tags = payloadTags(p);
        const meta = renderMetaLines(p.meta).map((row) => `${row.k}: ${row.v}`).join(' | ');
        const chunks = [
            payloadTitle(p),
            fmtTs(p.ts),
            tags.length ? `Tags: ${tags.join(', ')}` : '',
            meta,
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

    $: void recomputePosition();
    $: if (payload) void recomputePosition();
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
                <div class="dt">{payloadSubtitle(payload)}</div>
            </div>
            <div class="headRight">
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
            {#if payloadTags(payload).length > 0}
                <div class="ui-tag-row">
                    {#each payloadTags(payload) as tag, i (`tag:${tag}:${i}`)}
                        <span class="ui-tag">{tag}</span>
                    {/each}
                </div>
            {/if}

            {#each renderMetaLines(payload.meta) as row (row.k + row.v)}
                <div class="metaRow">
                    <span class="k">{row.k}</span>
                    <span class="v">{row.v}</span>
                </div>
            {/each}

        {:else if payload.kind === 'boundary'}
            {#if payloadTags(payload).length > 0}
                <div class="ui-tag-row">
                    {#each payloadTags(payload) as tag, i (`tag:${tag}:${i}`)}
                        <span class="ui-tag">{tag}</span>
                    {/each}
                </div>
            {/if}

            {#each renderMetaLines(payload.meta) as row (row.k + row.v)}
                <div class="metaRow">
                    <span class="k">{row.k}</span>
                    <span class="v">{row.v}</span>
                </div>
            {/each}

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
        gap: 8px;
    }

    .topIconBtn {
        min-width: 34px;
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

    .metaRow {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 6px 12px 0;
        opacity: 0.9;
    }

    .metaRow .k {
        opacity: 0.7;
    }

    .metaRow .v {
        font-variant-numeric: tabular-nums;
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
