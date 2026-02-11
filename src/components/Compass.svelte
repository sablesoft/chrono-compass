<!-- src/components/Compass.svelte -->
<script lang="ts">
    // Compass MVP: now draws selected targets
    import { createWheelGeom, SPOKE_LABELS } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import DocsModal from './DocsModal.svelte';
    import Tooltip from './Tooltip.svelte';
    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { useTooltip } from '../lib/wheel/ui/useTooltip';
    import { type MarkerCluster, type MarkerItem } from '../lib/wheel/wheel';

    import WheelControl from './WheelControl.svelte';

    import { wheels } from '../lib/catalog';
    import type { WheelRolesState } from '../lib/wheel/control';
    import type { WheelSpec, CompassRoleSet, BodyId } from '../lib/catalog';

    // NEW: compass engine
    import { computeCompassTargets, compassTargetsToMarkerItems } from '../lib/wheel/compass';
    import {compassClusters} from "../lib/wheel/ui/compassClusters";

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;
    export let onUserActivity: () => void = () => {};

    const dbg = debug('COMPASS', '🧭');

    const docs = useDocs(
        () => 'concept/compass.md',
        {
            getTitle: () => 'Compass Wheel',
            dbg,
            tag: () => 'compass'
        }
    );
    const docsState = docs.state;

    /* =======================
       WheelControl state (applied)
       ======================= */
    const spec: Extract<WheelSpec, { type: 'compass' }> = wheels.compass;

    function pickDefaultRoles(s: Extract<WheelSpec, { type: 'compass' }>): WheelRolesState {
        const rs: CompassRoleSet | undefined = s.roles?.[0];
        if (!rs) return {};

        const looker = rs.looker?.[0] ?? null;
        const target = rs.target?.[0] ?? null;

        // у Compass нет focus — оставляем как null, чтобы WheelControl спокойно жил
        return { looker, focus: null, target };
    }

    let roles: WheelRolesState = pickDefaultRoles(spec);
    let title = '';

    function handleApply(payload: { roles: WheelRolesState; title: string }) {
        onUserActivity();

        roles = payload.roles;
        title = payload.title;

        dbg.group?.('WheelControl.apply', () => {
            dbg.log?.('roles', roles);
            dbg.log?.('title', title);
        });
    }

    function handleMarkerPick(ts0: number) {
        onUserActivity();
        // можно сделать jumpTo позже, пока просто выставим selectedTs если нужно
        // но у компаса сейчас нет jumpTo, так что хотя бы закрываем:
        tip.closeNow();
    }

    function handleCancel() {
        dbg.log('WheelControl.cancel');
    }

    /* =======================
       GEOM (same as Wheel)
       ======================= */
    const geom = createWheelGeom(16, 1000);
    const labels = SPOKE_LABELS;
    const spokeCount = geom.spokeCount;

    const VB = geom.VB;
    const cx = geom.cx;
    const cy = geom.cy;
    const rOuter = geom.rOuter;
    const rLabel = geom.rLabel;

    const rHorizon = rOuter * 0.87;

    const boundaryAngleDeg = geom.boundaryAngleDeg;
    const spokeAngleDeg = geom.spokeAngleDeg;
    const polarToXY = geom.polarToXY;

    // TEMP (как в Wheel): orbit in [0..1] -> map into [zenith..horizon]
    function orbitToRadiusVB(orbit: number) {
        const o = Math.max(0, orbit);

        if (o <= 1) {
            // visible sky: zenith → horizon
            return rHorizon * o;
        } else {
            // below horizon: horizon → outer rim
            const t = Math.min(1, o - 1); // map [1..2] → [0..1]
            return rHorizon + (rOuter - rHorizon) * t;
        }
    }

    function pieSectorPath(a0: number, a1: number, r: number) {
        const p0 = polarToXY(0, a0);
        const p1 = polarToXY(r, a0);
        const p2 = polarToXY(r, a1);
        const p3 = polarToXY(0, a1);

        const largeArc = Math.abs(a1 - a0) > 180 ? 1 : 0;

        return [
            `M ${p0.x} ${p0.y}`,
            `L ${p1.x} ${p1.y}`,
            `A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
            `L ${p3.x} ${p3.y}`,
            'Z'
        ].join(' ');
    }

    const MIN_ARC_PX = 28;
    let markerClusters: MarkerCluster[] = [];

    function handleMarkerActivate(c: MarkerCluster) {
        dbg.log('Cluster Activate', c);
    }

    function asBodyIdArray(v: unknown): BodyId[] {
        if (Array.isArray(v)) return v.filter(Boolean) as BodyId[];
        if (typeof v === 'string' && v) return [v as BodyId];
        return [];
    }

    function asBodyIdOrNull(v: unknown): BodyId | null {
        if (typeof v === 'string' && v) return v as BodyId;
        if (Array.isArray(v) && typeof v[0] === 'string') return (v[0] as BodyId) ?? null;
        return null;
    }

    $: {
        const looker = asBodyIdOrNull(roles.looker) ?? 'Earth';
        const targets = asBodyIdArray(roles.target);

        dbg.log?.('Compass.recalc.in', {
            selectedTs,
            lat,
            lon,
            looker,
            targets,
            roles
        });

        if (!targets.length) {
            markerClusters = [];
            dbg.log?.('Compass.recalc.out', { reason: 'no targets' });
        } else {
            const solved = computeCompassTargets({
                ts: selectedTs,
                looker,
                observer: { lat, lon },
                targets,
                refraction: false,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
            });

            if (!solved.ok) {
                markerClusters = [];
                dbg.log?.('Compass.recalc.out', { ok: false, reason: solved.reason });
            } else {
                const items: MarkerItem[] = compassTargetsToMarkerItems(selectedTs, solved.targets, looker);

                dbg.log?.('Compass.items', {
                    count: items.length,
                    sample: items[0]
                });

                markerClusters = compassClusters(items, orbitToRadiusVB, MIN_ARC_PX);

                dbg.log?.('Compass.clusters', {
                    count: markerClusters.length,
                    sample: markerClusters[0]
                });
            }
        }
    }

    /* =======================
       Responsive (same as Wheel)
       ======================= */
    const responsive = useWheelResponsive();
    let size = 360;
    $: size = responsive.size;

    let wrapEl: HTMLDivElement | null = null;
    $: responsive.bindWrap(wrapEl);

    let isCoarsePointer = false;
    $: isCoarsePointer = responsive.isCoarsePointer;

    const tip = useTooltip({
        isCoarsePointer: () => isCoarsePointer,
        onActivateCluster: (c) => handleMarkerActivate(c),
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });
    const tipState = tip.state;
</script>

<section class="panel">
    <header class="top">
        <WheelControl
                type="compass"
                {roles}
                {title}
                onApply={handleApply}
                onCancel={handleCancel}
        />

        <div class="right">
            <button type="button" class="navBtn" title="Previous" disabled>←</button>
            <button type="button" class="navBtn" title="Next" disabled>→</button>
            <button
                    type="button"
                    class="navBtn"
                    title="Docs"
                    on:click={docs.openDocs}
            >i</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Compass Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rHorizon} fill="none" class="horizon" />

                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}

                        <g class="tick" aria-hidden="true">
                            <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} class="tickLine" />
                            <circle cx={pHit.x} cy={pHit.y} r={VB * 0.03} fill="transparent" />
                        </g>
                    {/each}

                    <g class="quadrants" aria-hidden="true" transform={`rotate(90 ${cx} ${cy})`}>
                        <path d={pieSectorPath(-45,  -135, rHorizon)} class="q q-red" />
                        <path d={pieSectorPath(-135, -225, rHorizon)} class="q q-white" />
                        <path d={pieSectorPath(-225, -315, rHorizon)} class="q q-blue" />
                        <path d={pieSectorPath(-315, -405, rHorizon)} class="q q-gold" />
                    </g>

                    {#each labels as label, i (label)}
                        {@const a = spokeAngleDeg(i)}
                        {@const p1 = { x: cx, y: cy }}
                        {@const p2 = polarToXY(rOuter, a)}
                        {@const pt = polarToXY(rLabel, a)}

                        <g class="spoke" aria-hidden="true">
                            <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke="currentColor"
                                    stroke-opacity={0.35}
                                    stroke-width={i % 4 === 0 ? 4 : 2}
                                    stroke-linecap="round"
                            />

                            <text
                                    class="spokeLabel"
                                    x={pt.x} y={pt.y}
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={VB * 0.035}
                                    fill="currentColor"
                                    fill-opacity={0.65}
                            >
                                {label}
                            </text>

                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = orbitToRadiusVB(c.orbit)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}

                        <g
                                class="marker"
                                data-marker="1"
                                transform={`translate(${p.x} ${p.y})`}
                                style={`opacity:${c.opacity ?? 1}`}
                                on:click={(e) => tip.handleClusterClick(e, c)}
                                on:mouseenter={(e) => { if (!isCoarsePointer) tip.hoverClusterEnter(e, c, markerKey); }}
                                on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                                on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}
                        >
                            <circle r={VB * 0.035} fill="transparent" />

                            <circle
                                    r={VB * 0.02}
                                    fill="transparent"
                                    stroke="currentColor"
                                    stroke-opacity="0.45"
                                    stroke-width="3"
                            />
                            <text
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={c.count === 1 ? VB * 0.02 : VB * 0.028}
                                    font-weight={c.count === 1 ? 500 : 800}
                                    letter-spacing={c.count === 1 ? 0 : 0.6}
                                    fill="currentColor"
                                    fill-opacity="0.95"
                                    style="pointer-events:none"
                                    stroke={c.count > 1 ? "var(--bg)" : "none"}
                                    stroke-width={c.count > 1 ? 4 : 0}
                                    paint-order="stroke"
                            >
                                {c.count === 1 ? c.emoji : c.label}
                            </text>
                        </g>
                    {/each}

                    <circle cx={cx} cy={cy} r={VB * 0.006} class="zenith" />
                </svg>
            </div>

            {#if $tipState.open && ($tipState.cluster || $tipState.moment)}
                <Tooltip
                        x={$tipState.x}
                        y={$tipState.y}
                        cluster={$tipState.cluster}
                        moment={$tipState.moment}
                        onPickTs={handleMarkerPick}
                        onMouseEnter={tip.keepOpen}
                        onMouseLeave={tip.scheduleClose}
                        onClose={tip.closeNow}
                />
            {/if}
        </section>
    </div>

    <div class="info">
        <div class="infoRow">
            <button class="jump" type="button" disabled>
                <strong class="k">FIX:</strong>
                <span class="dt">—</span>
                <span class="sep">—</span>
                <span class="desc">No fixed target</span>
            </button>

            <span class="houseBtns">
                <button type="button" class="hb" disabled>start</button>
                <button type="button" class="hb" disabled>end</button>
            </span>
        </div>

        <div class="infoRow">
            <button class="jump" type="button" disabled>
                <strong class="k">AZ:</strong>
                <span class="dt">—</span>
                <span class="sep">—</span>
                <span class="desc">Spoke / boundary navigation</span>
            </button>

            <span class="houseBtns">
                <button type="button" class="hb" disabled>prev</button>
                <button type="button" class="hb" disabled>next</button>
            </span>
        </div>
    </div>
</section>

<DocsModal
        open={$docsState.open}
        title={$docsState.title}
        md={$docsState.loading ? '# Loading…' : $docsState.md}
        url={$docsState.url}
        onClose={docs.closeDocs}
/>

<style>
    .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        padding: 14px;
        overflow: hidden;
    }

    .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .title {
        font-size: 24px;
        font-weight: 650;
        opacity: 0.95;
    }

    .right { display: flex; gap: 10px; }

    .navBtn {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }
    .navBtn:hover:not(:disabled) {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .navBtn:active:not(:disabled) { transform: translateY(0px); }
    .navBtn:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 65%);
        outline-offset: 3px;
    }
    .navBtn:disabled { opacity: 0.45; cursor: default; transform: none; }

    .wrap {
        width: 100%;
        max-width: 100%;
    }

    .wheelPanel {
        display: grid;
        gap: 10px;
        width: 100%;
        justify-items: center;
    }

    .wheelBox {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: stretch;
        overflow: hidden;
    }

    .wheelBox svg {
        width: 100%;
        height: 100%;
        display: block;
    }

    svg {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
    }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .tickLine{
        stroke: currentColor;
        stroke-opacity: 0.32;
        stroke-width: 5;
        stroke-linecap: round;
    }

    .spokeLabel {
        pointer-events: none;
    }

    .wheel-code {
        font-size: 16px;
        margin-top: 7px;
        border-top: 1px solid var(--btn-border);
    }

    .info {
        width: 100%;
        max-width: 100%;
        font-size: 18px;
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: 2px;
    }

    .infoRow {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 4px 6px;
        border-radius: 10px;
    }

    .jump {
        display: grid;
        grid-template-columns: 32px auto 18px 1fr;
        align-items: center;
        gap: 6px;

        width: 100%;
        min-width: 0;

        background: transparent;
        border: 0;
        padding: 0;
        border-radius: 8px;

        text-align: left;
        font: inherit;
        color: inherit;

        cursor: pointer;
    }
    .jump:hover { background: color-mix(in oklab, var(--fg), transparent 92%); }
    .jump:active { background: color-mix(in oklab, var(--fg), transparent 88%); }
    .jump:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 2px;
    }

    .k { text-align: right; opacity: 0.85; }
    .dt { font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0.95; }
    .desc {
        opacity: 0.6;
        font-weight: 700;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .houseBtns {
        display: inline-flex;
        justify-content: flex-end;
        gap: 8px;
        align-items: center;
    }

    .hb {
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-size: 14px;
        font-weight: 800;
        opacity: 0.9;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
    }
    .hb:hover {
        opacity: 1;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .hb:active { transform: translateY(0px); }
    .hb:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 70%);
        outline-offset: 2px;
    }
    .hb:disabled { opacity: 0.45; cursor: default; transform: none; }

    .horizon {
        stroke: currentColor;
        stroke-opacity: 0.28;
        stroke-width: 6;
    }

    .zenith {
        fill: currentColor;
        opacity: 0.85;
    }

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }
</style>
