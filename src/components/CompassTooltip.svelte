<!-- src/components/CompassTooltip.svelte -->
<!--suppress HtmlUnknownTag -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { MarkerCluster, MomentTip, MarkerItem } from '../lib/wheel/wheel';
    import type { ObjId } from '../lib/catalog';
    import { formatDateTime } from '../lib/format';
    import {clamp, norm360} from "../lib/math/helpers";

    export let x = 0;
    export let y = 0;

    export let moment: MomentTip | null = null;   // Compass uses this as "house tip"
    export let cluster: MarkerCluster | null = null;

    export let allBodies: {
        id: ObjId;
        emoji: string;
        name: string;
        distanceAu: number;
        distanceLabel: string;
        primaryDeg: number;
        secondaryDeg: number;
        primaryLabel: string;
        secondaryLabel: string;
        aboveLabel: string;
        belowLabel: string;
        house: string;        // E/ENE/...
        visible: boolean;
        activeNode?: MomentTip | null;
    }[] = [];

    export let pinnedBodyId: ObjId | null = null;
    export let onTogglePin: (bodyId: ObjId) => void = () => {};

    export let onPickTs: (ts: number) => void = () => {};
    export let onMouseEnter: () => void = () => {};
    export let onMouseLeave: () => void = () => {};
    export let onClose: () => void = () => {};

    const GAP = 12;
    const MAX_W = 420;
    const MAX_H = 420;
    const SEAM_NEXT_EPS_MS = 1500;

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

    function fmtDistAu(x: number) {
        if (!Number.isFinite(x)) return '—';
        const AU_KM = 149_597_870.7;
        const absAu = Math.abs(x);
        if (absAu < 0.005) {
            const km = x * AU_KM;
            const absKm = Math.abs(km);
            if (absKm >= 1_000_000_000) return `${(km / 1_000_000_000).toFixed(3)}B km`;
            if (absKm >= 1_000_000) return `${(km / 1_000_000).toFixed(3)}M km`;
            if (absKm >= 1_000) return `${(km / 1_000).toFixed(3)}K km`;
            return `${km.toFixed(1)} km`;
        }
        return `${x.toFixed(3)} AU`;
    }

    function titleCaseWords(text: string): string {
        return text
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    // Compass spokes: E, ENE, ..., ESE (16)
    const HOUSE_LABELS = ['E','ENE','NE','NNE','N','NNW','NW','WNW','W','WSW','SW','SSW','S','SSE','SE','ESE'] as const;
    const STEP_DEG = 360 / 16;

    function houseFromWheelAngle(angleDeg: number): string {
        const i = Math.round(norm360(-angleDeg) / STEP_DEG) % 16;
        return HOUSE_LABELS[i] ?? '—';
    }

    type BodyRow = {
        id: ObjId;
        emoji: string;
        name: string;
        distanceAu: number;
        distanceLabel: string;
        primaryDeg: number;
        secondaryDeg: number;
        primaryLabel: string;
        secondaryLabel: string;
        aboveLabel: string;
        belowLabel: string;
        house: string;
        visible: boolean;
        opacity?: number;
    };

    function markerItemToBodyRow(it: MarkerItem): BodyRow {
        const id = String(it.baseId).startsWith('body:') ? (String(it.baseId).slice(5) as ObjId) : (it.baseId as any);

        let az = (it.angleDeg + 90) % 360;
        if (az < 0) az += 360;

        const o = Math.max(0, it.orbit);
        const alt = o <= 1 ? (90 - o * 90) : (-(o - 1) * 90);

        return {
            id,
            emoji: it.emoji ?? '•',
            name: it.title ?? String(id),
            distanceAu: NaN,
            distanceLabel: 'Dist',
            primaryDeg: az,
            secondaryDeg: alt,
            primaryLabel: 'Az',
            secondaryLabel: 'Alt',
            aboveLabel: 'above',
            belowLabel: 'below',
            house: '—',
            visible: alt >= 0,
            opacity: (it as any).opacity
        };
    }

    // boolean (NOT type-guard) to avoid Svelte "never"
    function isHouseMoment(m: MomentTip | null): boolean {
        return !!m?.desc && m.desc.startsWith('house:');
    }

    function isOrbitNodeMoment(m: MomentTip | null): boolean {
        return !!m?.desc && m.desc.startsWith('orbit-node:');
    }

    function pickTsListForMoment(m: MomentTip | null): number[] {
        if (!m) return [];
        if (Array.isArray(m.pickTsList) && m.pickTsList.length > 0) {
            return m.pickTsList.filter((ts) => Number.isFinite(ts)).sort((a, b) => a - b);
        }
        return Number.isFinite(m.ts) ? [m.ts] : [];
    }

    function pickTargetTs(ts: number, idx: number, len: number): number {
        if (len > 1 && idx === len - 1) return ts + SEAM_NEXT_EPS_MS;
        return ts;
    }

    $: clusterSingleId = (() => {
        if (!cluster || cluster.count !== 1) return null;
        const it = cluster.items?.[0];
        if (!it) return null;
        const raw = String(it.baseId ?? '');
        return (raw.startsWith('body:') ? raw.slice(5) : raw) as ObjId;
    })();
    $: clusterNodeMoment = (!moment && clusterSingleId)
        ? (allBodies.find((b) => b.id === clusterSingleId)?.activeNode ?? null)
        : null;
    $: displayMoment = moment ?? clusterNodeMoment;

    $: momentPickTs = pickTsListForMoment(displayMoment);
    $: momentTags = Array.isArray(displayMoment?.tags)
        ? displayMoment.tags.filter((t) => typeof t === 'string' && t.trim().length > 0)
        : [];
    $: momentMetaText = typeof displayMoment?.metaText === 'string' && displayMoment.metaText.trim().length > 0
        ? displayMoment.metaText
        : '';
    $: momentMetaParts = Array.isArray(displayMoment?.metaParts)
        ? displayMoment.metaParts.filter((t) => typeof t === 'string' && t.trim().length > 0)
        : (momentMetaText ? momentMetaText.split(' • ').map((t) => t.trim()).filter(Boolean) : []);
    $: momentTagsUi = momentTags.map((t) => titleCaseWords(t));
    $: momentMetaPartsUi = momentMetaParts.map((p) => titleCaseWords(p));
    $: momentCopyText = typeof displayMoment?.copyText === 'string' && displayMoment.copyText.trim().length > 0
        ? displayMoment.copyText
        : momentMetaText;

    async function copyMomentMeta() {
        const text = momentCopyText;
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

    $: activeHouse = isHouseMoment(moment) ? (moment!.desc!.slice('house:'.length) || moment!.label) : null;

    // Cluster rows (then enrich from allBodies)
    $: rowsFromCluster = cluster ? cluster.items.map(markerItemToBodyRow) : [];
    $: rowsClusterEnriched = rowsFromCluster.map(r => {
        const found = allBodies.find(b => b.id === r.id);
        return found
            ? {
                ...r,
                house: found.house,
                name: found.name,
                emoji: found.emoji,
                distanceAu: found.distanceAu,
                distanceLabel: found.distanceLabel,
                primaryDeg: found.primaryDeg,
                secondaryDeg: found.secondaryDeg,
                primaryLabel: found.primaryLabel,
                secondaryLabel: found.secondaryLabel,
                aboveLabel: found.aboveLabel,
                belowLabel: found.belowLabel,
                visible: found.visible
            }
            : r;
    });

    // House rows (from allBodies)
    $: rowsFromHouse = activeHouse
        ? (allBodies.filter(b => b.house === activeHouse).map(b => ({
            id: b.id,
            emoji: b.emoji,
            name: b.name,
            distanceAu: b.distanceAu,
            distanceLabel: b.distanceLabel,
            primaryDeg: b.primaryDeg,
            secondaryDeg: b.secondaryDeg,
            primaryLabel: b.primaryLabel,
            secondaryLabel: b.secondaryLabel,
            aboveLabel: b.aboveLabel,
            belowLabel: b.belowLabel,
            house: b.house,
            visible: b.visible,
            opacity: undefined
        })) as BodyRow[])
        : ([] as BodyRow[]);

    $: bodyRows = (activeHouse ? rowsFromHouse : (cluster ? rowsClusterEnriched : [])) as BodyRow[];
    $: bodyRowsSorted = [...bodyRows].sort((a, b) => b.secondaryDeg - a.secondaryDeg);
    $: aboveRows = bodyRowsSorted.filter(r => r.secondaryDeg >= 0);
    $: belowRows = bodyRowsSorted.filter(r => r.secondaryDeg < 0);

    // Pinned row snapshot (always from allBodies)
    $: pinnedRow = pinnedBodyId ? allBodies.find(b => b.id === pinnedBodyId) ?? null : null;

    // Cluster house: prefer single-body house; fallback by angle
    $: clusterHouse = (() => {
        if (!cluster) return null;

        // 1) if single item -> use that body (most intuitive)
        const head = cluster.items?.[0];
        if (head) {
            const headId = String(head.baseId).startsWith('body:') ? (String(head.baseId).slice(5) as ObjId) : (head.baseId as any);
            const found = allBodies.find(b => b.id === headId);
            if (found?.house) return found.house;
        }

        // 2) fallback: derive from cluster angle
        return houseFromWheelAngle(cluster.angleDeg);
    })();

    // Header house priority:
    // pinned > activeHouse (spoke hover) > clusterHouse (marker hover) > moment label > —
    $: headerHouse =
        (isOrbitNodeMoment(moment) ? 'orbit node' : null)
        ?? activeHouse
        ?? clusterHouse
        ?? moment?.label
        ?? '—';

    $: nodeMomentText = (isOrbitNodeMoment(displayMoment) && Number.isFinite(displayMoment?.ts))
        ? formatDateTime(displayMoment!.ts)
        : '';

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
            tabindex="-1"
            aria-label="Compass details"
            on:mouseenter={onMouseEnter}
            on:mouseleave={onMouseLeave}
            on:wheel|stopPropagation
    >
        <header class="head">
            <div class="headLeft">
                <div class="house">{headerHouse}</div>
                <div class="sub">
                    {#if isHouseMoment(moment)}
                        <span class="muted">House bodies</span>
                    {:else if cluster}
                        <span class="muted">{cluster.count} {cluster.count === 1 ? 'body' : 'objects'}</span>
                {:else if displayMoment?.ts}
                        <span class="muted">{formatDateTime(displayMoment.ts)}</span>
                {/if}
            </div>
        </div>

            <div class="headRight">
                {#if pinnedBodyId}
                    <button class="navBtn miniBtn" type="button" disabled title="Soon: jump to this spoke in the future">↻</button>
                    <button class="navBtn miniBtn" type="button" disabled title="Soon: jump to this spoke in the past">↺</button>
                {/if}
                {#if !isHouseMoment(displayMoment) && momentPickTs.length === 1}
                    <button
                            class="navBtn miniBtn topIconBtn"
                            type="button"
                            title="Go to this moment"
                            aria-label="Go to this moment"
                            on:click={() => onPickTs(momentPickTs[0])}
                    >↪</button>
                {:else if !isHouseMoment(displayMoment) && momentPickTs.length > 1}
                    {#each momentPickTs as ts, i (`pick-top:${ts}:${i}`)}
                        <button
                                class="navBtn miniBtn topIconBtn"
                                type="button"
                                title={`Go to ${formatDateTime(ts)}`}
                                aria-label={`Go to ${formatDateTime(ts)}`}
                                on:click={() => onPickTs(pickTargetTs(ts, i, momentPickTs.length))}
                        >◷</button>
                    {/each}
                {/if}
                {#if isOrbitNodeMoment(displayMoment) && momentCopyText}
                    <button
                            class="navBtn miniBtn topIconBtn"
                            type="button"
                            title="Copy meta"
                            aria-label="Copy meta"
                            on:click={copyMomentMeta}
                    >⧉</button>
                {/if}
                <button class="navBtn close" type="button" aria-label="Close" on:click={onClose}>×</button>
            </div>
        </header>

        <div class="topExtras">
            {#if nodeMomentText}
                <div class="nodeMoment">{nodeMomentText}</div>
            {/if}
            {#if momentTags.length > 0}
                <div class="ui-tag-row">
                    {#each momentTagsUi as tag, i (`tag:${tag}:${i}`)}
                        <span class="ui-tag">{tag}</span>
                    {/each}
                </div>
            {/if}

            {#if isOrbitNodeMoment(displayMoment) && momentMetaPartsUi.length > 0}
                <div class="ui-tag-row">
                    {#each momentMetaPartsUi as p, i (`meta:${p}:${i}`)}
                        <span class="ui-tag">{p}</span>
                    {/each}
                </div>
            {/if}
        </div>

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
                            <span class="k">{pinnedRow.primaryLabel}</span>
                            <span class="v">{fmtDeg(pinnedRow.primaryDeg)}</span>
                        </div>

                        <div class="kv">
                            <span class="k">{pinnedRow.secondaryLabel}</span>
                            <span class="v">{fmtDeg(pinnedRow.secondaryDeg)}</span>
                        </div>

                        <div class="kv">
                            <span class="k">{pinnedRow.distanceLabel}</span>
                            <span class="v">{fmtDistAu(pinnedRow.distanceAu)}</span>
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
                                <span class="vis ok">{row.aboveLabel}</span>
                            </div>

                            <div class="d">
                                <span>{row.primaryLabel} {fmtDeg(row.primaryDeg)}</span>
                                <span class="sep">•</span>
                                <span>{row.secondaryLabel} {fmtDeg(row.secondaryDeg)}</span>
                                <span class="sep">•</span>
                                <span>{row.distanceLabel} {fmtDistAu(row.distanceAu)}</span>
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
                                <span class="vis bad">{row.belowLabel}</span>
                            </div>

                            <div class="d">
                                <span>{row.primaryLabel} {fmtDeg(row.primaryDeg)}</span>
                                <span class="sep">•</span>
                                <span>{row.secondaryLabel} {fmtDeg(row.secondaryDeg)}</span>
                                <span class="sep">•</span>
                                <span>{row.distanceLabel} {fmtDistAu(row.distanceAu)}</span>
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
        flex-wrap: wrap;
        justify-content: flex-end;
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

    .muted { opacity: 0.75; }

    .topExtras {
        padding: 10px 12px 0;
        display: grid;
        gap: 8px;
    }
    .nodeMoment {
        font-size: 12px;
        opacity: 0.85;
        padding: 0 2px;
    }

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
        grid-template-columns: 26px 1fr auto auto auto auto;
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
        justify-content: flex-start;
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
