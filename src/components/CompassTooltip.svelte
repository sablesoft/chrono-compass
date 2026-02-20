<!-- src/components/CompassTooltip.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { MarkerCluster, MomentTip, MarkerItem } from '../lib/wheel/wheel';
    import type { BodyId } from '../lib/catalog';
    import { formatDateTime } from '../lib/format';
    import {clamp, norm360} from "../lib/math/helpers";

    export let x = 0;
    export let y = 0;

    export let moment: MomentTip | null = null;   // Compass uses this as "house tip"
    export let cluster: MarkerCluster | null = null;

    export let allBodies: {
        id: BodyId;
        emoji: string;
        name: string;
        azimuthDeg: number;
        altitudeDeg: number;
        house: string;        // E/ENE/...
        visible: boolean;
    }[] = [];

    export let pinnedBodyId: BodyId | null = null;
    export let onTogglePin: (bodyId: BodyId) => void = () => {};

    export let onPickTs: (ts: number) => void = () => {};
    export let onMouseEnter: () => void = () => {};
    export let onMouseLeave: () => void = () => {};
    export let onClose: () => void = () => {};

    const GAP = 12;
    const MAX_W = 420;
    const MAX_H = 420;

    let el: HTMLDivElement | null = null;
    let left = 0;
    let top = 0;

    function updatePosition() {
        const vw = window.innerWidth || 1000;
        const vh = window.innerHeight || 800;

        const rect = el?.getBoundingClientRect();
        const w = rect?.width ?? MAX_W;
        const h = rect?.height ?? MAX_H;

        const preferLeft = x + GAP;
        const preferTop = y + GAP;

        left = clamp(preferLeft, 8, Math.max(8, vw - w - 8));
        top  = clamp(preferTop,  8, Math.max(8, vh - h - 8));

        if (preferTop + h + 8 > vh) {
            const flippedTop = y - GAP - h;
            top = clamp(flippedTop, 8, Math.max(8, vh - h - 8));
        }

        if (preferLeft + w + 8 > vw) {
            const flippedLeft = x - GAP - w;
            left = clamp(flippedLeft, 8, Math.max(8, vw - w - 8));
        }
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }

    function fmtDeg(x: number) {
        return `${x.toFixed(1)}°`;
    }

    // Compass spokes: E, ENE, ..., ESE (16)
    const HOUSE_LABELS = ['E','ENE','NE','NNE','N','NNW','NW','WNW','W','WSW','SW','SSW','S','SSE','SE','ESE'] as const;
    const STEP_DEG = 360 / 16;

    function houseFromWheelAngle(angleDeg: number): string {
        const i = Math.round(norm360(-angleDeg) / STEP_DEG) % 16;
        return HOUSE_LABELS[i] ?? '—';
    }

    type BodyRow = {
        id: BodyId;
        emoji: string;
        name: string;
        azimuthDeg: number;
        altitudeDeg: number;
        house: string;
        visible: boolean;
        opacity?: number;
    };

    function markerItemToBodyRow(it: MarkerItem): BodyRow {
        const id = String(it.baseId).startsWith('body:') ? (String(it.baseId).slice(5) as BodyId) : (it.baseId as any);

        let az = (it.angleDeg + 90) % 360;
        if (az < 0) az += 360;

        const o = Math.max(0, it.orbit);
        const alt = o <= 1 ? (90 - o * 90) : (-(o - 1) * 90);

        return {
            id,
            emoji: it.emoji ?? '•',
            name: it.title ?? String(id),
            azimuthDeg: az,
            altitudeDeg: alt,
            house: '—',
            visible: alt >= 0,
            opacity: (it as any).opacity
        };
    }

    // boolean (NOT type-guard) to avoid Svelte "never"
    function isHouseMoment(m: MomentTip | null): boolean {
        return !!m?.desc && m.desc.startsWith('house:');
    }

    $: activeHouse = isHouseMoment(moment) ? (moment!.desc!.slice('house:'.length) || moment!.label) : null;

    // Cluster rows (then enrich from allBodies)
    $: rowsFromCluster = cluster ? cluster.items.map(markerItemToBodyRow) : [];
    $: rowsClusterEnriched = rowsFromCluster.map(r => {
        const found = allBodies.find(b => b.id === r.id);
        return found
            ? { ...r, house: found.house, name: found.name, emoji: found.emoji, azimuthDeg: found.azimuthDeg, altitudeDeg: found.altitudeDeg, visible: found.visible }
            : r;
    });

    // House rows (from allBodies)
    $: rowsFromHouse = activeHouse
        ? (allBodies.filter(b => b.house === activeHouse).map(b => ({
            id: b.id,
            emoji: b.emoji,
            name: b.name,
            azimuthDeg: b.azimuthDeg,
            altitudeDeg: b.altitudeDeg,
            house: b.house,
            visible: b.visible,
            opacity: undefined
        })) as BodyRow[])
        : ([] as BodyRow[]);

    $: bodyRows = (activeHouse ? rowsFromHouse : (cluster ? rowsClusterEnriched : [])) as BodyRow[];
    $: bodyRowsSorted = [...bodyRows].sort((a, b) => b.altitudeDeg - a.altitudeDeg);
    $: aboveRows = bodyRowsSorted.filter(r => r.altitudeDeg >= 0);
    $: belowRows = bodyRowsSorted.filter(r => r.altitudeDeg < 0);

    // Pinned row snapshot (always from allBodies)
    $: pinnedRow = pinnedBodyId ? allBodies.find(b => b.id === pinnedBodyId) ?? null : null;

    // Cluster house: prefer single-body house; fallback by angle
    $: clusterHouse = (() => {
        if (!cluster) return null;

        // 1) if single item -> use that body (most intuitive)
        const head = cluster.items?.[0];
        if (head) {
            const headId = String(head.baseId).startsWith('body:') ? (String(head.baseId).slice(5) as BodyId) : (head.baseId as any);
            const found = allBodies.find(b => b.id === headId);
            if (found?.house) return found.house;
        }

        // 2) fallback: derive from cluster angle
        return houseFromWheelAngle(cluster.angleDeg);
    })();

    // Header house priority:
    // pinned > activeHouse (spoke hover) > clusterHouse (marker hover) > moment label > —
    $: headerHouse =
        activeHouse
        ?? clusterHouse
        ?? moment?.label
        ?? '—';

    function clickBody(row: BodyRow) {
        onTogglePin(row.id);
    }

    $: hasContent = !!moment || !!cluster;

    onMount(() => {
        if (hasContent) updatePosition();
        const raf = requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('keydown', onKeyDown);
        return () => cancelAnimationFrame(raf);
    });

    onDestroy(() => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('keydown', onKeyDown);
    });

    $: { if (hasContent) queueMicrotask(updatePosition); }
</script>

{#if hasContent}
    <div
            class="tip"
            data-tooltip-root
            bind:this={el}
            style={`left:${left}px; top:${top}px;`}
            role="dialog"
            aria-label="Compass details"
            on:mouseenter={onMouseEnter}
            on:mouseleave={onMouseLeave}
            on:wheel|stopPropagation
            on:click|stopPropagation
            on:mousedown|stopPropagation
    >
        <header class="head">
            <div class="headLeft">
                <div class="house">{headerHouse}</div>
                <div class="sub">
                    {#if isHouseMoment(moment)}
                        <span class="muted">House bodies</span>
                    {:else if cluster}
                        <span class="muted">{cluster.count} {cluster.count === 1 ? 'body' : 'bodies'}</span>
                    {:else if moment?.ts}
                        <span class="muted">{formatDateTime(moment.ts)}</span>
                    {/if}
                </div>
            </div>

            <div class="headRight">
                {#if pinnedBodyId}
                    <button class="navBtn miniBtn" type="button" disabled title="Soon: jump to this spoke in the future">↻</button>
                    <button class="navBtn miniBtn" type="button" disabled title="Soon: jump to this spoke in the past">↺</button>
                {/if}
                <button class="navBtn close" type="button" aria-label="Close" on:click={onClose}>×</button>
            </div>
        </header>

        {#if pinnedBodyId}
            <section class="pinned">
                <div class="pinnedTitle">Pinned</div>

                {#if pinnedRow}
                    <div class="pinnedRow">
                        <div class="emo">{pinnedRow.emoji}</div>
                        <div class="name">{pinnedRow.name}</div>

                        <div class="kv">
                            <span class="k">House</span>
                            <span class="v">{pinnedRow.house}</span>
                        </div>

                        <div class="kv">
                            <span class="k">Az</span>
                            <span class="v">{fmtDeg(pinnedRow.azimuthDeg)}</span>
                        </div>

                        <div class="kv">
                            <span class="k">Alt</span>
                            <span class="v">{fmtDeg(pinnedRow.altitudeDeg)}</span>
                        </div>
                    </div>
                {:else}
                    <div class="pinnedRow muted">
                        Pinned body is not in targets.
                    </div>
                {/if}
            </section>
        {/if}

        <section class="list">
            <div class="listHead">
                <div class="label">Bodies</div>

                {#if moment?.ts && !isHouseMoment(moment)}
                    <button class="go" type="button" on:click={() => onPickTs(moment?.ts)}>Go to this moment</button>
                {/if}
            </div>

            {#if bodyRowsSorted.length === 0}
                <div class="empty">No bodies here.</div>
            {:else}
                {#each aboveRows as row (row.id)}
                    <button
                            type="button"
                            class="item"
                            class:pinned={pinnedBodyId === row.id}
                            on:click={() => clickBody(row)}
                            title="Click to pin/unpin"
                            style={`opacity:${row.opacity ?? 1}`}
                    >
                        <div class="l"><span class="emoji">{row.emoji}</span></div>

                        <div class="m">
                            <div class="t">
                                <span class="name">{row.name}</span>
                                <span class="vis ok">above</span>
                            </div>

                            <div class="d">
                                <span>Az {fmtDeg(row.azimuthDeg)}</span>
                                <span class="sep">•</span>
                                <span>Alt {fmtDeg(row.altitudeDeg)}</span>
                            </div>
                        </div>

                        <div class="r">
                            <span class="mini" title="Soon: related wheels" aria-hidden="true">⎈</span>
                        </div>
                    </button>
                {/each}

                {#if aboveRows.length > 0 && belowRows.length > 0}
                    <div class="horizonSep">
                        <div class="line"></div>
                        <div class="txt">HORIZON</div>
                        <div class="line"></div>
                    </div>
                {/if}

                {#each belowRows as row (row.id)}
                    <button
                            type="button"
                            class="item below"
                            class:pinned={pinnedBodyId === row.id}
                            on:click={() => clickBody(row)}
                            title="Click to pin/unpin"
                            style={`opacity:${row.opacity ?? 0.65}`}
                    >
                        <div class="l"><span class="emoji">{row.emoji}</span></div>

                        <div class="m">
                            <div class="t">
                                <span class="name">{row.name}</span>
                                <span class="vis bad">below</span>
                            </div>

                            <div class="d">
                                <span>Az {fmtDeg(row.azimuthDeg)}</span>
                                <span class="sep">•</span>
                                <span>Alt {fmtDeg(row.altitudeDeg)}</span>
                            </div>
                        </div>

                        <div class="r">
                            <span class="mini" title="Soon: related wheels" aria-hidden="true">⎈</span>
                        </div>
                    </button>
                {/each}
            {/if}
        </section>
    </div>
{/if}

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
        box-shadow: 0 16px 50px rgba(0,0,0,0.35);
        backdrop-filter: blur(8px);
        overflow: hidden;
        display: grid;
        grid-template-rows: auto auto 1fr;
    }

    .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
    }

    .headLeft { min-width: 0; display: grid; gap: 2px; }
    .house {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .sub { font-size: 12px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .headRight {
        display: flex;
        gap: 10px;
    }

    .muted { opacity: 0.75; }

    .pinned {
        padding: 10px 12px;
        border-bottom: 1px solid color-mix(in oklab, var(--fg), transparent 90%);
        background: color-mix(in oklab, var(--fg), transparent 96%);
    }
    .pinnedTitle {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
        margin-bottom: 8px;
    }
    .pinnedRow {
        display: grid;
        grid-template-columns: 26px 1fr auto auto auto;
        gap: 10px;
        align-items: center;
        min-width: 0;
    }
    .emo { font-size: 18px; text-align: center; }
    .name { font-weight: 750; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .kv { display: grid; gap: 1px; }
    .k { font-size: 10px; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.08em; }
    .v { font-size: 12px; font-weight: 700; white-space: nowrap; }

    .list { padding: 10px 10px 12px; overflow: auto; }

    .listHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 0 2px 10px;
    }
    .label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
    }

    .go {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--fg), transparent 92%);
        color: var(--fg);
        border-radius: 10px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
    }
    .go:hover { background: color-mix(in oklab, var(--fg), transparent 90%); }

    .empty { padding: 10px 6px; font-size: 12px; opacity: 0.75; }

    .item {
        width: 100%;
        text-align: left;
        display: grid;
        grid-template-columns: 30px 1fr 28px;
        gap: 10px;
        padding: 8px 8px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fg);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
        margin-bottom: 6px;
    }
    .item:hover {
        background: color-mix(in oklab, var(--fg), transparent 93%);
        border-color: color-mix(in oklab, var(--fg), transparent 86%);
        transform: translateY(-0.5px);
    }
    .item.pinned {
        border-color: color-mix(in oklab, var(--accent-live), transparent 55%);
        background: color-mix(in oklab, var(--accent-live), transparent 92%);
    }
    .item.below { opacity: 0.8; }

    .l { display: grid; place-items: center; }
    .emoji { font-size: 20px; }

    .m { min-width: 0; display: grid; gap: 2px; }
    .t { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .t .name { font-size: 13px; font-weight: 800; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

    .houseTag { font-size: 11px; font-weight: 900; letter-spacing: 0.08em; opacity: 0.8; }

    .vis {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        opacity: 0.85;
    }
    .vis.bad { opacity: 0.6; }

    .d { font-size: 12px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sep { margin: 0 6px; opacity: 0.6; }

    .r { display: grid; place-items: center; }
    .mini { opacity: 0.45; font-size: 14px; }

    .horizonSep {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 10px;
        padding: 8px 6px 10px;
        opacity: 0.75;
    }
    .horizonSep .line { height: 1px; background: color-mix(in oklab, var(--fg), transparent 84%); }
    .horizonSep .txt { font-size: 10px; font-weight: 900; letter-spacing: 0.12em; }
</style>
