<!-- src/components/CompassTooltip.svelte -->
<!--suppress HtmlUnknownTag -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { MarkerCluster, MomentTip, MarkerItem } from '../lib/wheel/types';
    import { objects, type ObjId } from '../lib/catalog';
    import { getPreferredLang2 } from '../lib/docs';
    import type { SavedWheel } from '../lib/profile/types';
    import { formatDateTime } from '../lib/format';
    import { formatInfoValue } from '../lib/wheel/infoFormat';
    import { formatLabelTitleCaseUi, formatSpokeTextUi } from '../lib/wheel/types';
    import {clamp, norm360} from "../lib/math/helpers";
    import RelatedWheels from './RelatedWheels.svelte';

    export let x = 0;
    export let y = 0;

    export let moment: MomentTip | null = null;   // Compass uses this as "house tip"
    export let cluster: MarkerCluster | null = null;

    export let allBodies: {
        id: ObjId;
        emoji: string;
        name: string;
        color?: string;
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
    export let dynamicRows: Array<{
        id: ObjId;
        items: Array<{ id: string; label: string; value?: string; modal?: string }>;
    }> = [];
    export let dynamicDisabledIds: Set<string> = new Set();

    export let pinnedBodyId: ObjId | null = null;
    export let descriptionLabel = '';
    export let separatorLabel = 'HORIZON';
    export let onTogglePin: (bodyId: ObjId) => void = () => {};

    export let onPickTs: (ts: number) => void = () => {};
    export let onAddRelatedWheel: (input: {
        wheelType: SavedWheel['type'];
        title: string;
        roles: SavedWheel['roles'];
        observer?: SavedWheel['observer'];
        time?: SavedWheel['time'];
    }) => void = () => {};
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
    function themeColor(color?: string): string | undefined {
        if (typeof color !== 'string') return undefined;
        const trimmed = color.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

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
            return formatInfoValue('km', km);
        }
        return `${x.toFixed(3)} AU`;
    }

    function titleCaseWords(text: string): string {
        return formatLabelTitleCaseUi(text);
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
        color?: string;
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
        infoItems?: Array<{ id: string; label: string; value?: string; modal?: string }>;
    };

    let openInfoItemKey = '';
    let openMomentItemIndex = -1;

    function infoItemKey(scope: 'above' | 'below', rowId: ObjId, item: { id?: string; label: string }): string {
        const raw = (item.id && item.id.trim()) ? item.id : item.label;
        return `${scope}:${rowId}:${normalizeLabelKey(raw)}`;
    }

    function toggleInfoItem(
        scope: 'above' | 'below',
        rowId: ObjId,
        item: { id?: string; label: string },
        modal?: string
    ) {
        if (!modal) return;
        const key = infoItemKey(scope, rowId, item);
        openInfoItemKey = openInfoItemKey === key ? '' : key;
    }

    function handleInfoItemKeydown(
        e: KeyboardEvent,
        scope: 'above' | 'below',
        rowId: ObjId,
        item: { id?: string; label: string },
        modal?: string
    ) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleInfoItem(scope, rowId, item, modal);
        }
    }

    function openInfoForRow(scope: 'above' | 'below', row: BodyRow): { key: string; item: { id: string; label: string; value?: string; modal?: string } } | null {
        if (!row.infoItems || row.infoItems.length === 0) return null;
        for (let i = 0; i < row.infoItems.length; i++) {
            const item = row.infoItems[i];
            const key = infoItemKey(scope, row.id, item);
            if (openInfoItemKey === key) return { key, item };
        }
        return null;
    }

    function normalizeLabelKey(text: string): string {
        return String(text ?? '').trim().toLowerCase();
    }

    function uniqueBodyInfoItems(items: Array<{ id: string; label: string; value?: string; modal?: string }>, excluded: Set<string>) {
        return items.filter((item) => !excluded.has(normalizeLabelKey(item.label)));
    }

    function descriptionInfoItem(id: ObjId): { id: string; label: string; modal: string } | null {
        const obj = (objects as any)[id] as { description?: { en: string; ru?: string } } | undefined;
        const desc = obj?.description;
        if (!desc) return null;
        const lang = getPreferredLang2();
        const text = (desc as any)[lang] || desc.en;
        if (typeof text !== 'string' || !text.trim()) return null;
        const label = descriptionLabel && descriptionLabel.trim().length > 0
            ? descriptionLabel.trim()
            : (lang === 'ru' ? 'Описание' : 'Description');
        return { id: 'system:description', label, modal: text.trim() };
    }

    function filteredRowInfoItems(row: BodyRow) {
        return uniqueBodyInfoItems(row.infoItems ?? [], momentInfoLabelSet);
    }

    function openInfoForFilteredRow(scope: 'above' | 'below', row: BodyRow) {
        return openInfoForRow(scope, { ...row, infoItems: filteredRowInfoItems(row) });
    }

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
            color: typeof (objects as any)?.[id]?.meta?.color === 'string' ? (objects as any)[id].meta.color : undefined,
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
    $: momentTechTags = Array.isArray(displayMoment?.techTags)
        ? displayMoment.techTags.filter((t) => typeof t === 'string' && t.trim().length > 0)
        : [];
    $: momentInfoItems = Array.isArray(displayMoment?.infoItems)
        ? displayMoment.infoItems
            .filter((x) => x && typeof x.label === 'string' && x.label.trim().length > 0)
            .filter((x) => {
                const id = typeof x.id === 'string' ? x.id : '';
                if (!id) return true;
                return !dynamicDisabledIds.has(id);
            })
        : [];
    $: momentTopItems = (() => {
        const out = momentInfoItems.slice();
        if (!isOrbitNodeMoment(displayMoment)) return out;
        for (let i = 0; i < momentTechTagsUi.length; i++) {
            const label = momentTechTagsUi[i];
            out.push({
                id: `tech:${i}:${label}`,
                label
            });
        }
        return out;
    })();
    $: momentInfoLabelSet = new Set(momentInfoItems.map((x) => normalizeLabelKey(x.label)));
    $: momentMetaText = typeof displayMoment?.metaText === 'string' && displayMoment.metaText.trim().length > 0
        ? displayMoment.metaText
        : '';
    $: momentTechTagsUi = momentTechTags.map((t) => titleCaseWords(t));
    $: momentCopyText = typeof displayMoment?.copyText === 'string' && displayMoment.copyText.trim().length > 0
        ? formatSpokeTextUi(displayMoment.copyText)
        : formatSpokeTextUi(momentMetaText);
    $: if (!displayMoment) openMomentItemIndex = -1;

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

    function toggleMomentItem(index: number, modal?: string) {
        if (!modal) return;
        openMomentItemIndex = openMomentItemIndex === index ? -1 : index;
    }

    $: activeHouse = isHouseMoment(moment) ? (moment!.desc!.slice('house:'.length) || moment!.label) : null;

    // Cluster rows (then enrich from allBodies)
    $: rowsFromCluster = cluster ? cluster.items.map(markerItemToBodyRow) : [];
    $: rowsClusterEnriched = rowsFromCluster.map(r => {
        const found = allBodies.find(b => b.id === r.id);
        const dynamic = dynamicRows.find((x) => x.id === r.id);
        return found
            ? {
                ...r,
                house: found.house,
                name: found.name,
                emoji: found.emoji,
                color: found.color,
                distanceAu: found.distanceAu,
                distanceLabel: found.distanceLabel,
                primaryDeg: found.primaryDeg,
                secondaryDeg: found.secondaryDeg,
                primaryLabel: found.primaryLabel,
                secondaryLabel: found.secondaryLabel,
                aboveLabel: found.aboveLabel,
                belowLabel: found.belowLabel,
                visible: found.visible,
                infoItems: [
                    ...(descriptionInfoItem(r.id) ? [descriptionInfoItem(r.id)!] : []),
                    ...(dynamic?.items ?? [])
                ]
            }
            : r;
    });

    // House rows (from allBodies)
    $: rowsFromHouse = activeHouse
        ? (allBodies.filter(b => b.house === activeHouse).map(b => ({
            id: b.id,
            emoji: b.emoji,
            name: b.name,
            color: b.color,
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
            opacity: undefined,
            infoItems: [
                ...(descriptionInfoItem(b.id) ? [descriptionInfoItem(b.id)!] : []),
                ...(dynamicRows.find((x) => x.id === b.id)?.items ?? [])
            ]
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
        formatSpokeTextUi(
            (isOrbitNodeMoment(moment) ? 'orbit node' : null)
            ?? activeHouse
            ?? clusterHouse
            ?? moment?.label
            ?? '—'
        );

    $: nodeMomentText = (isOrbitNodeMoment(displayMoment) && Number.isFinite(displayMoment?.ts))
        ? formatDateTime(displayMoment!.ts)
        : '';

    function clickBody(row: BodyRow) {
        onTogglePin(row.id);
    }

    function handleBodyKeydown(e: KeyboardEvent, row: BodyRow) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickBody(row);
        }
    }

    function handleRelatedWheelPicked(input: {
        wheelType: SavedWheel['type'];
        title: string;
        roles: SavedWheel['roles'];
        observer?: SavedWheel['observer'];
        time?: SavedWheel['time'];
    }) {
        onAddRelatedWheel(input);
        onClose();
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
                                title={i === 0 ? 'Go to Begin' : (i === momentPickTs.length - 1 ? 'Go to Next' : `Go to ${formatDateTime(ts)}`)}
                                aria-label={i === 0 ? 'Go to Begin' : (i === momentPickTs.length - 1 ? 'Go to Next' : `Go to ${formatDateTime(ts)}`)}
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
            {#if momentTopItems.length > 0}
                <div class="chipRow">
                    {#each momentTopItems as item, i (`top:${item.id ?? item.label}:${i}`)}
                        {#if item.modal}
                            <button
                                type="button"
                                class="ui-tag chipButton"
                                aria-expanded={openMomentItemIndex === i}
                                on:click={() => toggleMomentItem(i, item.modal)}
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
                {@const openMomentItem = openMomentItemIndex >= 0 ? momentTopItems[openMomentItemIndex] : null}
                {#if openMomentItem?.modal}
                    <div class="itemAccordion">
                        <div class="itemAccordionTitle">{openMomentItem.label}</div>
                        <div class="itemAccordionBody">{openMomentItem.modal}</div>
                    </div>
                {/if}
            {/if}
        </div>

        {#if pinnedBodyId}
            <section class="pinned">
                {#if pinnedRow}
                    <div class="pinnedRow" title="Pinned body">
                        <span class="prefix">Pinned: </span>
                        <span class="pin useObjectColor" style={`color:${themeColor(pinnedRow.color) ?? 'inherit'}`}>{pinnedRow.emoji}</span>
                        <span class="pinName useObjectColor" style={`color:${themeColor(pinnedRow.color) ?? 'inherit'}`}>{pinnedRow.name}</span>
                        <span class="pinSpoke">{pinnedRow.house}</span>
                    </div>
                {:else}
                    <div class="pinnedRow muted">
                        <span class="pin">📌</span>
                        <span class="pinName">Pinned body is not in targets.</span>
                        <span class="pinSpoke">—</span>
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
                    <div class="itemWrap" style={`opacity:${row.opacity ?? 1}`}>
                        <div
                                class="item"
                                role="button"
                                tabindex="0"
                                on:click={() => clickBody(row)}
                                on:keydown={(e) => handleBodyKeydown(e, row)}
                                title="Click to pin/unpin"
                        >
                            <div class="l"><span class="emoji useObjectColor" style={`color:${themeColor(row.color) ?? 'inherit'}`}>{row.emoji}</span></div>

                            <div class="m">
                                <div class="t">
                                    <span class="name useObjectColor" style={`color:${themeColor(row.color) ?? 'inherit'}`}>{row.name}</span>
                                    <span class="vis ok">{row.aboveLabel}</span>
                                </div>

                                {#if filteredRowInfoItems(row).length > 0}
                                    <div class="chipRow">
                                        {#each filteredRowInfoItems(row) as item, j (`above:${row.id}:${item.id}:${j}`)}
                                            {@const key = infoItemKey('above', row.id, item)}
                                            {#if item.modal}
                                                <button
                                                    type="button"
                                                    class="ui-tag chipButton chipAction"
                                                    aria-expanded={openInfoItemKey === key}
                                                    on:mousedown|stopPropagation|preventDefault
                                                    on:click|stopPropagation|preventDefault={() => toggleInfoItem('above', row.id, item, item.modal)}
                                                    on:keydown|stopPropagation={(e) => handleInfoItemKeydown(e, 'above', row.id, item, item.modal)}
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
                                    {@const openInfo = openInfoForFilteredRow('above', row)}
                                    {#if openInfo?.item.modal}
                                        <div class="itemAccordion">
                                            <div class="itemAccordionTitle">{openInfo.item.label}</div>
                                            <div class="itemAccordionBody">{openInfo.item.modal}</div>
                                        </div>
                                    {/if}
                                {:else}
                                    <div class="d">
                                        <span>{row.primaryLabel} {fmtDeg(row.primaryDeg)}</span>
                                        <span class="sep">•</span>
                                        <span>{row.secondaryLabel} {fmtDeg(row.secondaryDeg)}</span>
                                        {#if Number.isFinite(row.distanceAu) && row.distanceLabel}
                                            <span class="sep">•</span>
                                            <span>{row.distanceLabel} {fmtDistAu(row.distanceAu)}</span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <RelatedWheels
                                objId={row.id}
                                pinnedId={pinnedBodyId}
                                onPickWheel={handleRelatedWheelPicked}
                        />
                    </div>
                {/each}

                {#if aboveRows.length > 0 && belowRows.length > 0}
                    <div class="horizonSep">
                        <div class="line"></div>
                        <div class="txt">{separatorLabel}</div>
                        <div class="line"></div>
                    </div>
                {/if}

                {#each belowRows as row (row.id)}
                    <div class="itemWrap" style={`opacity:${row.opacity ?? 0.65}`}>
                        <div
                                class="item below"
                                role="button"
                                tabindex="0"
                                on:click={() => clickBody(row)}
                                on:keydown={(e) => handleBodyKeydown(e, row)}
                                title="Click to pin/unpin"
                        >
                            <div class="l"><span class="emoji useObjectColor" style={`color:${themeColor(row.color) ?? 'inherit'}`}>{row.emoji}</span></div>

                            <div class="m">
                                <div class="t">
                                    <span class="name useObjectColor" style={`color:${themeColor(row.color) ?? 'inherit'}`}>{row.name}</span>
                                    <span class="vis bad">{row.belowLabel}</span>
                                </div>

                                {#if filteredRowInfoItems(row).length > 0}
                                    <div class="chipRow">
                                        {#each filteredRowInfoItems(row) as item, j (`below:${row.id}:${item.id}:${j}`)}
                                            {@const key = infoItemKey('below', row.id, item)}
                                            {#if item.modal}
                                                <button
                                                    type="button"
                                                    class="ui-tag chipButton chipAction"
                                                    aria-expanded={openInfoItemKey === key}
                                                    on:mousedown|stopPropagation|preventDefault
                                                    on:click|stopPropagation|preventDefault={() => toggleInfoItem('below', row.id, item, item.modal)}
                                                    on:keydown|stopPropagation={(e) => handleInfoItemKeydown(e, 'below', row.id, item, item.modal)}
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
                                    {@const openInfo = openInfoForFilteredRow('below', row)}
                                    {#if openInfo?.item.modal}
                                        <div class="itemAccordion">
                                            <div class="itemAccordionTitle">{openInfo.item.label}</div>
                                            <div class="itemAccordionBody">{openInfo.item.modal}</div>
                                        </div>
                                    {/if}
                                {:else}
                                    <div class="d">
                                        <span>{row.primaryLabel} {fmtDeg(row.primaryDeg)}</span>
                                        <span class="sep">•</span>
                                        <span>{row.secondaryLabel} {fmtDeg(row.secondaryDeg)}</span>
                                        {#if Number.isFinite(row.distanceAu) && row.distanceLabel}
                                            <span class="sep">•</span>
                                            <span>{row.distanceLabel} {fmtDistAu(row.distanceAu)}</span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <RelatedWheels
                                objId={row.id}
                                pinnedId={pinnedBodyId}
                                onPickWheel={handleRelatedWheelPicked}
                        />
                    </div>
                {/each}
            {/if}
        </section>
    </div>
{/if}

<style>
    .tip {
        position: fixed;
        z-index: 50;
        width: min(460px, calc(100vw - 16px));
        max-height: min(460px, calc(100vh - 16px));
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
        padding: 6px 12px;
        border-bottom: 1px solid color-mix(in oklab, var(--fg), transparent 90%);
        background: color-mix(in oklab, var(--fg), transparent 97%);
    }
    .pinnedRow {
        display: flex;
        align-items: center;
        gap: 8px;
        align-items: center;
        min-height: 24px;
        min-width: 0;
    }
    .prefix {
        font-size: 12px;
        white-space: nowrap;
        padding-right: 10px;
    }
    .pin {
        font-size: 14px;
        width: 16px;
        text-align: center;
        flex: 0 0 auto;
    }
    .pinName {
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
    }
    .pinSpoke {
        margin-left: auto;
        flex: 0 0 auto;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.85;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        border-radius: 999px;
        padding: 1px 6px;
    }

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

    .itemWrap {
        margin-bottom: 4px;
        position: relative;
    }

    .item {
        width: 100%;
        text-align: left;
        display: grid;
        grid-template-columns: 30px 1fr;
        gap: 10px;
        padding: 8px 36px 8px 8px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fg);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
        margin-bottom: 0;
    }
    .item:hover {
        background: color-mix(in oklab, var(--fg), transparent 93%);
        border-color: color-mix(in oklab, var(--fg), transparent 86%);
        transform: translateY(-0.5px);
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

    .chipRow {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .chipButton {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
        color: inherit;
        cursor: pointer;
    }
    .chipAction {
        display: inline-flex;
        cursor: pointer;
    }

    :global([data-theme="light"]) .useObjectColor {
        color: inherit !important;
    }
    .chipStatic {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }
    .chipLine {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    .chipLabel {
        font-weight: 700;
    }
    .chipDivider {
        width: 1px;
        height: 1.1em;
        background: color-mix(in oklab, var(--fg), transparent 84%);
    }
    .chipValue {
        font-weight: 800;
    }
    .itemAccordion {
        margin-top: 6px;
        margin-left: 40px;
        border-left: 2px solid color-mix(in oklab, var(--fg), transparent 84%);
        padding-left: 10px;
    }
    .itemAccordionTitle {
        font-size: 12px;
        font-weight: 800;
        opacity: 0.9;
        margin-bottom: 2px;
    }
    .itemAccordionBody {
        font-size: 14px;
        opacity: 0.84;
        line-height: 1.35;
    }

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
