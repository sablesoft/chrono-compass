<!-- src/components/Wheel.svelte -->
<!-- LEGACY: keep this component stable; do not add new behavior here.
     Migrate legacy cycles to Cycle.svelte and the new engine instead. -->
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get } from 'svelte/store';

    import type { CycleKind } from '../lib/stores/cycle';
    import { formatDateTime, ms } from '../lib/format';

    import { setSelectedTs } from '../lib/time/store';
    import { momentsState } from '../lib/stores/moment';

    import { debug } from '../lib/debug';

    import type { MarkerCluster, MomentTip } from '../lib/wheel/wheel';
    import {
        buildHouseBoundaries,
        computeAnchors,
        computeAngle,
        createMomentClickHandler,
        SHIFT_EPS_MS,
        SPOKES,
        buildSpokeTip,
        buildBoundaryTip
    } from '../lib/wheel/wheel';

    import { buildWheelModel } from '../lib/wheel/model';
    import { cmdShiftCycle } from '../lib/wheel/commands';
    import { PointerAnimator } from '../lib/wheel/pointerAnimator';
    import { nearestSpokeByTime } from '../lib/wheel/spokes';

    import Tooltip from './Tooltip.svelte';
    import { CYCLE_META, SPOKE_DESC } from '../lib/cycle/meta';

    import DocsModal from './DocsModal.svelte';

    // NEW: geometry + hooks
    import { createWheelGeom, SPOKE_LABELS, safeAngle } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useNowPointer } from '../lib/wheel/ui/useNowPointer';
    import { useTooltip } from '../lib/wheel/ui/useTooltip';
    import { useDocs } from "../lib/docs";
    import { buildMarkerItemsForWheel, clusterMarkerItems } from "../lib/wheel/ui/wheelClusters";

    export let kind: CycleKind = 'diurnal';
    export let lat: number;
    export let lon: number;
    export let selectedTs: number;
    export let onUserActivity: () => void = () => {};

    function kindChannel(k: CycleKind) {
        switch (k) {
            case 'diurnal': return 'DIURNAL';
            case 'lunarSynodic': return 'LUNAR_SYNODIC';
            case 'lunarDraconic': return 'LUNAR_DRACONIC';
            case 'lunarAnomalistic': return 'LUNAR_ANOMALISTIC';
            case 'solarTropical': return 'SOLAR_TROPICAL';
            case 'solarAnomalistic': return 'SOLAR_ANOMALISTIC';
            case 'plato': return 'PLATO';
            default: return 'WHEEL';
        }
    }

    const dbgWheel = debug('WHEEL', '🧭');
    $: dbgWheel.log('kind switch', { kind, channel: kindChannel(kind) });
    let dbg: ReturnType<typeof debug>;
    $: dbg = debug(kindChannel(kind), '🧭');

    let wheelTag = '';
    $: wheelTag = `${kind}@${lat?.toFixed?.(2) ?? lat},${lon?.toFixed?.(2) ?? lon}`;

    /* =======================
       GEOM
       ======================= */
    const geom = createWheelGeom(16, 1000);
    const labels = SPOKE_LABELS;
    const spokeCount = geom.spokeCount;

    const VB = geom.VB;
    const cx = geom.cx;
    const cy = geom.cy;
    const rOuter = geom.rOuter;
    const rInner = geom.rInner;
    const rLabel = geom.rLabel;

    const boundaryAngleDeg = geom.boundaryAngleDeg;
    const spokeAngleDeg = geom.spokeAngleDeg;
    const polarToXY = geom.polarToXY;
    const ringSectorPath = geom.ringSectorPath;

    /* =======================
       Responsive
       ======================= */
    const responsive = useWheelResponsive();
    let size = 360;
    $: size = responsive.size;

    let wrapEl: HTMLDivElement | null = null;
    $: responsive.bindWrap(wrapEl);

    let isCoarsePointer = false;
    $: isCoarsePointer = responsive.isCoarsePointer;

    /* =======================
       Docs
       ======================= */
    const docs = useDocs(
        () => 'cycles/' + kind + '.md',
        {
            dbg,
            tag: () => wheelTag
        }
    );
    const docsState = docs.state;

    /* =======================
       Derived model
       ======================= */
    let anchors = computeAnchors(kind, selectedTs, lat, lon);
    $: anchors = computeAnchors(kind, selectedTs, lat, lon);

    let pointerAngleDeg = 0;
    $: pointerAngleDeg = computeAngle(kind, selectedTs, anchors);

    let model = buildWheelModel({ anchors, selectedTs });
    $: model = buildWheelModel({ anchors, selectedTs });

    let spokeTimes: number[] = [];
    $: spokeTimes = model.spokeTimes;

    let boundaryTimes: number[] = [];
    $: boundaryTimes = model.boundaryTimes;

    let houseBoundaries: number[] = [];
    $: houseBoundaries = buildHouseBoundaries(spokeTimes);

    /* =======================
       Markers => clusters
       ======================= */
    let markerClusters: MarkerCluster[] = [];
    const MIN_ARC_PX = 28;

    function orbitToRadiusVB(orbit: number) {
        return rInner + (rOuter - rInner) * orbit;
    }

    $: {
        const s = get(momentsState);
        const colById = new Map(s.collections.map(c => [c.id, { markerBg: c.markerBg, orbit: c.orbit }]));

        const items = buildMarkerItemsForWheel({
            kind,
            anchors,
            lat,
            lon,
            moments: s.moments as any,
            visibleCollectionIds: s.visibleCollectionIds,
            collectionById: colById
        });

        markerClusters = clusterMarkerItems(items, orbitToRadiusVB, MIN_ARC_PX);
    }

    /* =======================
       Current spoke tip
       ======================= */
    let currentSpokeTip: MomentTip | null = null;
    $: {
        if (!spokeTimes?.length) {
            currentSpokeTip = null;
        } else {
            const i = model.currentSpokeIndex;
            const label = (i === 16) ? 'E_next' : labels[i];
            const ts0 = spokeTimes[i];
            currentSpokeTip = ts0 ? buildSpokeTip(kind, label as any, ts0) : null;
        }
    }

    /* =======================
       Local UI state + animator
       ======================= */
    let selectedSpokeIndex: number | null = null;
    let isCycling = false;

    let lastSeenTs = selectedTs;
    let timeDir: -1 | 0 | 1 = 0;

    let displayAngle = 0;
    let noTransition = false;

    const animator = new PointerAnimator((s) => {
        // это и есть триггер Svelte-обновления на каждом кадре
        displayAngle = s.angleDeg;
        noTransition = s.noTransition;
    });

    const ANIM_MS = 420;

    function emitSelectTs(ts: number) {
        setSelectedTs(ms(ts));
    }

    function jumpTo(ts0: number, reason = 'jump') {
        onUserActivity();
        isCycling = false;
        selectedSpokeIndex = null;

        dbg.group(`${wheelTag} ${reason}`, () => {
            dbg.log('jumpTo', {
                selectedTs: new Date(selectedTs).toISOString(),
                targetTs: new Date(ms(ts0)).toISOString(),
                curSpoke: nearestSpokeByTime(selectedTs, spokeTimes),
                targetSpoke: nearestSpokeByTime(ms(ts0), spokeTimes),
                pointerAngleDeg,
                animatorAngle: animator.get().angleDeg,
                cycleKey: `${anchors.E}:${anchors.E_next}`
            });
        });

        emitSelectTs(ts0);
    }

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        const carryIndex = model.currentSpokeIndex === 16 ? 0 : model.currentSpokeIndex;

        const nav = cmdShiftCycle(
            dir,
            kind,
            selectedTs,
            lat,
            lon,
            anchors,
            spokeTimes,
            carryIndex
        );

        const aTarget = computeAnchors(kind, nav.targetTs, lat, lon);
        const landAngle = computeAngle(kind, nav.targetTs, aTarget);

        animator.play(
            { kind: 'fullTurn', dir, landAngleDeg: landAngle },
            ANIM_MS,
            (cb) => requestAnimationFrame(cb),
            () => { isCycling = false; }
        );

        emitSelectTs(nav.targetTs);
    }

    function handleNextE() {
        onUserActivity();
        if (isCycling) return;

        const curIdx = nearestSpokeByTime(selectedTs, spokeTimes);

        if (curIdx === 0) {
            shiftCycle(1);
            return;
        }

        isCycling = true;

        const endTs = anchors.E_next;
        const probe = endTs + SHIFT_EPS_MS;
        const a2 = computeAnchors(kind, probe, lat, lon);
        const nextE = ms(a2.E);

        animator.play(
            {
                kind: 'fullTurn',
                dir: 1,
                landAngleDeg: 0,
                onDoneResetTo: 0
            },
            ANIM_MS,
            (cb) => requestAnimationFrame(cb),
            () => {
                emitSelectTs(nextE);
                isCycling = false;
            }
        );
    }

    $: {
        const delta = selectedTs - lastSeenTs;
        timeDir = delta === 0 ? 0 : (delta > 0 ? 1 : -1);
        lastSeenTs = selectedTs;

        const cycleKey = `${anchors.E}:${anchors.E_next}`;
        animator.applyInput({ baseAngleDeg: pointerAngleDeg, timeDir, cycleKey });
    }

    let nearestSpokeIndex = 0;
    $: nearestSpokeIndex = model.currentSpokeIndex;

    /* =======================
       NOW pointer
       ======================= */
    const now = useNowPointer(() => kind, () => anchors, dbg);
    const nowState = now.state;

    // NEW: при любом изменении окна цикла/типа — пересчитать "now" немедленно
    $: {
        // привязываемся к ключевым полям окна, чтобы refresh вызвался именно когда надо
        const k = kind;
        const e0 = anchors?.E;
        const e1 = anchors?.E_next;
        // сам факт вычисления этих значений делает реактивную зависимость
        now.refresh?.(`deps:${k}:${e0}:${e1}`);
    }

    let showNowPointer = false;
    let nowPointerAngleDeg: number | null = null;
    let nowDisplayAngle = 0;

    $: showNowPointer = $nowState.show;
    $: nowPointerAngleDeg = $nowState.angleDeg;
    $: nowDisplayAngle = $nowState.displayAngle;

    /* =======================
       Info block helpers
       ======================= */
    const infoRows = [
        { key: 'E',  anchor: 'E',      houseIndex: 0,  showHouse: true },
        { key: 'N',  anchor: 'N',      houseIndex: 4,  showHouse: true },
        { key: 'W',  anchor: 'W',      houseIndex: 8,  showHouse: true },
        { key: 'S',  anchor: 'S',      houseIndex: 12, showHouse: true },
        { key: 'E+', anchor: 'E_next', houseIndex: 0,  showHouse: false }
    ] as const;

    type InfoItem = typeof infoRows[number] & { ts: number; desc: string };
    let infoItems: InfoItem[] = [];
    $: infoItems = infoRows.map(r => ({
        ...r,
        ts: anchors[r.anchor],
        desc: SPOKE_DESC[kind][r.anchor],
    }));

    type AnchorKey = typeof infoRows[number]['anchor'];
    function spokeDesc(k: AnchorKey) {
        return SPOKE_DESC[kind][k];
    }

    function houseStartTs(i: number) {
        if (i === 0) {
            const prevBase = anchors.E - SHIFT_EPS_MS;
            const aPrev = computeAnchors(kind, prevBase, lat, lon);
            const prevModel = buildWheelModel({ anchors: aPrev, selectedTs: prevBase });
            const prevESE = prevModel.spokeTimes[15];
            const curE = spokeTimes[0];
            return ms((prevESE + curE) / 2);
        }
        return boundaryTimes[(i - 1 + SPOKES) % SPOKES];
    }

    function houseEndTs(i: number) {
        return boundaryTimes[i];
    }

    /* =======================
       Tooltip (NEW hook)
       ======================= */
    function handleMarkerActivate(c: MarkerCluster) {
        jumpTo(c.ts, `marker:${c.id}`);
        tip.closeNow();
    }

    function centerClickEvent(target: EventTarget | null): MouseEvent | null {
        if (!(target instanceof Element)) return null;
        const r = target.getBoundingClientRect();
        return new MouseEvent('click', {
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
        });
    }

    function handleMarkerKeydown(e: KeyboardEvent, c: MarkerCluster) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const ev = centerClickEvent(e.currentTarget);
        if (ev) tip.handleClusterClick(ev, c);
    }

    const tip = useTooltip({
        isCoarsePointer: () => isCoarsePointer,
        onActivateCluster: (c) => handleMarkerActivate(c),
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });

    const tipState = tip.state;

    function handleMarkerPick(ts0: number) {
        jumpTo(ts0, `tipPick`);
        tip.closeNow();
    }

    /* =======================
       Click handlers
       ======================= */
    function handleSpokeActivate(i: number) {
        const t = spokeTimes[i];
        if (t) jumpTo(t, `spoke:${i}`);
    }

    function handleBoundaryActivate(i: number) {
        const t = boundaryTimes[i];
        if (t) jumpTo(t, `boundary:${i}`);
    }

    /* =======================
       Lifecycle
       ======================= */
    onMount(() => {});
    onDestroy(() => {});
</script>

<section class="panel">
    <header class="top">
        <div class="left">
            <div class="title">{CYCLE_META[kind].description}</div>
            <div class="wheel-code">{CYCLE_META[kind].label}</div>
        </div>

        <div class="right">
            <button type="button" class="navBtn" title="Docs" on:click={docs.openDocs}>i</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}
                        {@const boundaryTip = buildBoundaryTip(labels[i], labels[(i + 1) % spokeCount], boundaryTimes[i])}
                        {@const boundaryKey = `boundary:${i}`}
                        {@const boundaryClick = createMomentClickHandler({
                            onSingle: (e) => tip.openMomentNow(e, boundaryTip),
                            onDouble: () => handleBoundaryActivate(i),
                        })}

                        <g
                                class="tick"
                                role="button"
                                tabindex="0"
                                aria-label={`House boundary ${i + 1}`}
                                on:click={boundaryClick.onClick}
                                on:dblclick={boundaryClick.onDblClick}
                                on:mouseenter={(e) => tip.hoverMomentEnter(e, boundaryTip, boundaryKey)}
                                on:mouseleave={() => tip.hoverLeave(boundaryKey)}
                                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBoundaryActivate(i);
                  }
                }}
                        >
                            <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} class="tickLine" />
                            <circle cx={pHit.x} cy={pHit.y} r={VB * 0.03} fill="transparent" />
                        </g>
                    {/each}

                    <g class="quadrants" aria-hidden="true" transform={`rotate(90 ${cx} ${cy})`}>
                        <path d={ringSectorPath(-45, -135)} class="q q-red" />
                        <path d={ringSectorPath(-135, -225)} class="q q-white" />
                        <path d={ringSectorPath(-225, -315)} class="q q-blue" />
                        <path d={ringSectorPath(-315, -405)} class="q q-gold" />
                    </g>

                    {#each labels as label, i (label)}
                        {@const a = spokeAngleDeg(i)}
                        {@const p1 = polarToXY(rInner, a)}
                        {@const p2 = polarToXY(rOuter, a)}
                        {@const pt = polarToXY(rLabel, a)}
                        {@const spokeTip = buildSpokeTip(kind, label, spokeTimes[i])}
                        {@const spokeKey = `spoke:${i}`}
                        {@const spokeClick = createMomentClickHandler({
                            onSingle: (e) => tip.openMomentNow(e, spokeTip),
                            onDouble: () => handleSpokeActivate(i),
                        })}

                        <g
                                class="spoke"
                                role="button"
                                tabindex="0"
                                aria-label={`Spoke ${label}`}
                                on:click={spokeClick.onClick}
                                on:dblclick={spokeClick.onDblClick}
                                on:mouseenter={(e) => tip.hoverMomentEnter(e, spokeTip, spokeKey)}
                                on:mouseleave={() => tip.hoverLeave(spokeKey)}
                                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSpokeActivate(i);
                  }
                }}
                        >
                            <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke="currentColor"
                                    stroke-opacity={selectedSpokeIndex === i ? 0.9 : 0.35}
                                    stroke-width={i % 4 === 0 ? 4 : 2}
                                    stroke-linecap="round"
                            />

                            {#if i === nearestSpokeIndex}
                                <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={VB * 0.046}
                                        fill="transparent"
                                        stroke="currentColor"
                                        stroke-opacity="0.55"
                                        stroke-width="3"
                                />
                            {/if}

                            <text
                                    class="spokeLabel"
                                    x={pt.x} y={pt.y}
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={VB * 0.035}
                                    fill="currentColor"
                                    fill-opacity={selectedSpokeIndex === i ? 1 : 0.65}
                            >
                                {label}
                            </text>

                            {#if i === 0}
                                {@const pt2 = { x: pt.x + 5, y: pt.y + VB * 0.06 }}
                                {@const ePlusTip = buildSpokeTip(kind, 'E_next', spokeTimes[16])}
                                {@const ePlusKey = `eplus`}
                                {@const ePlusClick = createMomentClickHandler({
                                    onSingle: (e) => tip.openMomentNow(e, ePlusTip),
                                    onDouble: () => handleNextE()
                                })}

                                <g
                                        class="eplus"
                                        role="button"
                                        tabindex="0"
                                        aria-label="Spoke E+"
                                        on:click|stopPropagation={ePlusClick.onClick}
                                        on:dblclick|stopPropagation={ePlusClick.onDblClick}
                                        on:mouseenter={(e) => tip.hoverMomentEnter(e, ePlusTip, ePlusKey)}
                                        on:mouseleave={() => tip.hoverLeave(ePlusKey)}
                                        on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNextE();
                      }
                    }}
                                >
                                    {#if 16 === nearestSpokeIndex}
                                        <circle
                                                cx={pt2.x}
                                                cy={pt2.y}
                                                r={VB * 0.046}
                                                fill="transparent"
                                                stroke="currentColor"
                                                stroke-opacity="0.55"
                                                stroke-width="3"
                                        />
                                    {/if}

                                    <text
                                            class="spokeLabel eplusLabel"
                                            x={pt2.x} y={pt2.y}
                                            text-anchor="middle"
                                            dominant-baseline="middle"
                                            font-size={VB * 0.034}
                                            fill="currentColor"
                                            fill-opacity={0.55}
                                    >
                                        E+
                                    </text>
                                </g>
                            {/if}

                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    {#if showNowPointer && nowPointerAngleDeg !== null}
                        <g class="nowPointer" transform={`rotate(${safeAngle(nowDisplayAngle, 0)} ${cx} ${cy})`}>
                            <line
                                    x1={cx} y1={cy}
                                    x2={cx + rOuter} y2={cy}
                                    stroke="var(--accent-live)"
                                    stroke-width="10"
                                    stroke-linecap="round"
                                    stroke-opacity="0.35"
                            />
                            <circle
                                    cx={cx + rOuter}
                                    cy={cy}
                                    r={VB * 0.018}
                                    fill="var(--accent-live)"
                                    fill-opacity="0.65"
                                    role="button"
                                    tabindex="0"
                                    aria-label="Go LIVE (now)"
                                    on:click|stopPropagation={now.startLive}
                                    on:keydown|stopPropagation={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      now.startLive();
                    }
                  }}
                            />
                        </g>
                    {/if}

                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = orbitToRadiusVB(c.orbit)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}

                        <g
                                class="marker"
                                role="button"
                                tabindex="0"
                                data-marker="1"
                                transform={`translate(${p.x} ${p.y})`}
                                on:click={(e) => tip.handleClusterClick(e, c)}
                                on:keydown={(e) => handleMarkerKeydown(e, c)}
                                on:mouseenter={(e) => { if (!isCoarsePointer) tip.hoverClusterEnter(e, c, markerKey); }}
                                on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                                on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}
                        >
                            <circle r={VB * 0.035} fill="transparent" />

                            <circle
                                    r={VB * 0.02}
                                    fill={c.bg}
                                    stroke="currentColor"
                                    stroke-opacity="0.45"
                                    stroke-width="3"
                            />
                            <circle
                                    r={VB * 0.018}
                                    fill="none"
                                    stroke="var(--bg)"
                                    stroke-opacity="0.5"
                                    stroke-width="2"
                            />

                            <text
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={c.count === 1 ? VB * 0.02 : VB * 0.024}
                                    font-weight={c.count === 1 ? 500 : 800}
                                    letter-spacing={c.count === 1 ? 0 : 0.5}
                                    fill="currentColor"
                                    fill-opacity="0.95"
                                    style="pointer-events:none"
                            >
                                {c.count === 1 ? c.emoji : c.label}
                            </text>
                        </g>
                    {/each}

                    <g transform={`translate(${cx} ${cy})`}>
                        <g
                                class="pointer"
                                class:noTransition={noTransition}
                                style={`transform: rotate(${safeAngle(displayAngle, 0)}deg);`}
                        >
                            <line
                                    x1="0" y1="0"
                                    x2={rOuter} y2="0"
                                    stroke="currentColor"
                                    stroke-width="9"
                                    stroke-linecap="round"
                            />
                            <circle cx={rOuter} cy="0" r={VB * 0.02} fill="currentColor" />
                        </g>
                    </g>

                    <circle cx={cx} cy={cy} r={VB * 0.012} fill="currentColor" />
                </svg>

                <div class="cycleNav">
                    <button class="cycleUp navBtn" title="Next Cycle" on:click={() => shiftCycle(1)}>▲</button>
                    <button class="cycleDown navBtn" title="Previous Cycle" on:click={() => shiftCycle(-1)}>▼</button>
                </div>
            </div>

            {#if currentSpokeTip}
                <div class="currentSpoke">
                    <strong>{currentSpokeTip.label}</strong>
                </div>
            {/if}

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
        {#each infoItems as row (row.key)}
            <div class="infoRow">
                <button
                        class="jump"
                        type="button"
                        title={`Go to ${row.key}`}
                        on:click={() => jumpTo(row.ts, `info:${row.key}`)}
                >
                    <strong class="k">{row.key}:</strong>
                    <span class="dt">{formatDateTime(row.ts)}</span>
                    <span class={row.key === 'S' ? 'sep' : ''}>—</span>
                    <span class="desc">{spokeDesc(row.anchor)}</span>
                </button>

                {#if row.showHouse}
          <span class="houseBtns">
            <button
                    type="button"
                    class="hb"
                    title={`House start: ${formatDateTime(houseStartTs(row.houseIndex))}`}
                    on:click={() => jumpTo(houseStartTs(row.houseIndex), `house:start:${row.houseIndex}`)}
            >start</button>

            <button
                    type="button"
                    class="hb"
                    title={`House end: ${formatDateTime(houseEndTs(row.houseIndex))}`}
                    on:click={() => jumpTo(houseEndTs(row.houseIndex), `house:end:${row.houseIndex}`)}
            >end</button>
          </span>
                {/if}
            </div>
        {/each}
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
    .wrap {
        width: 100%;
        max-width: 100%;
    }

    /* Весь блок колеса + подпись */
    .wheelPanel {
        display: grid;
        gap: 10px;
        width: 100%;
        justify-items: center;
    }

    /* ТОЛЬКО колесо */
    .wheelBox {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: stretch;
        overflow: hidden;
        position: relative;
    }

    .wheelBox svg {
        width: 100%;
        height: 100%;
        display: block;
    }

    /* САМОЕ ВАЖНОЕ: svg занимает весь квадрат wrap */
    svg {
        display: block;
        width: 100%;
        height: 100%;

        /* опционально, но помогает избежать сюрпризов */
        max-width: none;
        max-height: none;
    }

    .spoke { cursor: pointer; user-select: none; }

    .pointer {
        transition: transform 420ms ease;
        transform-origin: 0 0;
        will-change: transform;
    }
    .pointer.noTransition { transition: none; }

    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 65%);
        outline-offset: 4px;
    }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .nowPointer { transition: transform 420ms ease; }
    .nowPointer circle { cursor: pointer; }
    .nowPointer:hover line,
    .nowPointer:hover circle {
        stroke-opacity: 0.85;
        fill-opacity: 0.9;
    }

    .spokeLabel {
        transition: fill-opacity 120ms ease, transform 120ms ease;
        pointer-events: auto;
    }
    .spokeLabel:hover {
        fill-opacity: 1;
        transform: scale(1.01);
        filter: drop-shadow(0 0 6px color-mix(in oklab, var(--fg), transparent 55%));
    }

    .eplus:hover .eplusLabel{
        fill-opacity: 1;
        transform: scale(1.01);
        filter: drop-shadow(0 0 6px color-mix(in oklab, var(--fg), transparent 55%));
    }

    .tick { cursor: pointer; }
    .tickLine{
        stroke: currentColor;
        stroke-opacity: 0.32;
        stroke-width: 5;
        stroke-linecap: round;
        transition: stroke-opacity 120ms ease;
    }
    .tick:hover .tickLine { stroke-opacity: 0.75; }
    .tick:focus { outline: none; }
    .tick:focus-visible .tickLine { stroke-opacity: 0.9; }

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }

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

    .currentSpoke{
        width: 100%;
        display: grid;
        place-items: center;
        margin-top: 10px;
        font-size: 18px;
        font-weight: 800;
        opacity: 0.92;
        text-align: center;
        user-select: none;
    }
    .wheel-code {
        font-size: 16px;
        margin-top: 7px;
        border-top: 1px solid var(--btn-border);
    }

    .cycleNav {
        position: absolute;
        top: 4px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .cycleUp,
    .cycleDown {
        width: 34px;
        height: 34px;
    }
</style>
