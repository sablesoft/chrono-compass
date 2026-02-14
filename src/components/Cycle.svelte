<!-- src/components/Cycle.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';

    import { createWheelGeom, SPOKE_LABELS, safeAngle } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useTooltip } from '../lib/wheel/ui/useTooltip';

    import DocsModal from './DocsModal.svelte';
    import Tooltip from './Tooltip.svelte';
    import WheelControl from './WheelControl.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { ms, formatDateTime } from '../lib/format';

    import { boardApi, boardItems } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    import { solveWheel } from '../lib/board/dispatcher';
    import type { WheelSolveResult, CycleSolveResult, CycleSpoke } from '../lib/board/runtime';

    import type { Location } from '../lib/location/types';
    import type { WheelObserverState, WheelTimeState, SpokeKey } from '../lib/wheel/types';

    import { selectedTs as globalSelectedTs, isLive as globalIsLive, setSelectedTs } from '../lib/time/store';

    import type { MarkerCluster, MomentTip } from '../lib/wheel/wheel';

    // ------------------------------------------------------------
    // Props (NEW contract: Board passes wheel + location)
    // ------------------------------------------------------------
    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: Location;
    export let onUserActivity: () => void = () => {};

    const dbg = debug('CYCLE', '🌀');

    // docs (per wheel type)
    const docs = useDocs(
        () => `cycles/${wheel?.wheelType}.md`,
        {
            getTitle: () => (wheel?.title?.trim?.() ? wheel.title : `Cycle: ${wheel?.wheelType}`),
            dbg,
            tag: () => String(wheel?.wheelType ?? 'cycle')
        }
    );
    const docsState = docs.state;

    // ------------------------------------------------------------
    // Local derived state from wheel
    // ------------------------------------------------------------
    $: wheelId = wheel?.wheelId;
    $: roles = (wheel?.roles ?? {}) as any;
    $: title = wheel?.title ?? '';

    $: observer = (wheel?.observer ?? { locationId: 'loc:system', locked: false }) as WheelObserverState;
    $: time = (wheel?.time ?? { live: true, locked: false }) as WheelTimeState;

    // Only “horizon” wheels show location controls for now
    $: isHorizon = wheel?.wheelType === 'horizon';

    // prefer passed-in location (already resolved in Board)
    $: wheelLoc = location;
    $: wheelLat = wheelLoc?.lat;
    $: wheelLon = wheelLoc?.lon;

    // close button logic (same idea as Compass)
    $: sameTypeCount = ($boardItems ?? []).filter((x) => x.wheelType === wheel?.wheelType).length;
    $: canClose = sameTypeCount > 1;

    function closeCycle() {
        if (!canClose) return;
        onUserActivity();
        boardApi.removeWheelById(wheelId, 'Cycle.close');
    }

    // ------------------------------------------------------------
    // Time sync: global <-> wheel time (same as Compass)
    // ------------------------------------------------------------
    let localLiveNowTs = ms(Date.now());
    let localLiveTimer: ReturnType<typeof setInterval> | null = null;
    let localAlignTimer: ReturnType<typeof setTimeout> | null = null;

    function clearLocalLiveTimers() {
        if (localAlignTimer) { clearTimeout(localAlignTimer); localAlignTimer = null; }
        if (localLiveTimer) { clearInterval(localLiveTimer); localLiveTimer = null; }
    }

    function startLocalLiveTicker() {
        clearLocalLiveTimers();
        localLiveNowTs = ms(Date.now());

        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);

        localAlignTimer = setTimeout(() => {
            localLiveNowTs = ms(Date.now());
            localLiveTimer = setInterval(() => {
                localLiveNowTs = ms(Date.now());
            }, 60_000);
        }, msToNextMinute + 5);
    }

    $: {
        const needLocalLive = !!time?.locked && !!time?.live;
        if (needLocalLive) startLocalLiveTicker();
        else clearLocalLiveTimers();
    }

    $: effTs =
        !time?.locked
            ? selectedTs
            : time?.live
                ? localLiveNowTs
                : ms((time as any)?.ts ?? selectedTs);

    let globalTs = ms(Date.now());
    let globalLive = true;

    const unsubGTs = globalSelectedTs.subscribe(v => globalTs = v);
    const unsubGLive = globalIsLive.subscribe(v => globalLive = v);

    onDestroy(() => {
        unsubGTs();
        unsubGLive();
        clearLocalLiveTimers();
    });

    // If wheel time isn't locked -> keep it synced to global time
    $: {
        if (wheelId)
            if (!time?.locked) {
                if (time.live !== globalLive || (time as any).ts !== (globalLive ? (time as any).ts : globalTs)) {
                    boardApi.updateWheelTime(
                        wheelId,
                        globalLive ? { live: true } : { live: false, ts: globalTs },
                        'Cycle.syncWheelTime'
                    );
                }
            }
    }

    // If observer isn't locked -> keep it synced to passed-in location (ONLY for horizon wheels)
    $: {
        if (wheelId && isHorizon)
            if (!observer?.locked && wheelLoc?.id && observer.locationId !== wheelLoc.id) {
                boardApi.updateWheelObserver(wheelId, { locationId: wheelLoc.id }, 'Cycle.syncObserverLocation');
            }
    }

    // ------------------------------------------------------------
    // Geometry (same as Wheel)
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // Responsive + tooltip
    // ------------------------------------------------------------
    const responsive = useWheelResponsive();
    let size = 360;
    $: size = responsive.size;

    let wrapEl: HTMLDivElement | null = null;
    $: responsive.bindWrap(wrapEl);

    let isCoarsePointer = false;
    $: isCoarsePointer = responsive.isCoarsePointer;

    function buildMomentTip(label: string, ts0: number, desc = ''): MomentTip {
        return { label, ts: ts0, desc };
    }

    const tip = useTooltip({
        isCoarsePointer: () => isCoarsePointer,
        onActivateCluster: (_c: MarkerCluster) => {},
        hoverDelayMs: 600,
        closeDelayMs: 120,
        ignoreOutsideSelectors: ['[data-tooltip-root]', '[data-marker]'],
    });
    const tipState = tip.state;

    // ------------------------------------------------------------
    // Solve via runtime dispatcher (CycleSolveResult)
    // ------------------------------------------------------------
    let solveOk = false;
    let solveReason = '';
    let spokes: CycleSpoke<any>[] = [];

    $: {
        solveOk = false;
        solveReason = '';
        spokes = [];

        if (!wheel || !wheelLoc || !wheelId) {
            solveReason = 'No wheel';
        } else {
            const ctx = {
                ts: effTs,
                location: isHorizon ? wheelLoc : undefined,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
            };

            const res: WheelSolveResult = solveWheel(wheel as any, ctx);

            if (!res || res.kind !== 'cycle') {
                solveReason = 'Not a cycle result';
            } else {
                const r = res as CycleSolveResult<any>;
                solveOk = !!r.ok;
                solveReason = r.ok ? '' : (r as any).reason ?? 'Solve failed';
                spokes = (r.spokes ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
            }
        }
    }

    // spokeTimes[0..16], boundaryTimes[0..15]
    let spokeTimes: number[] = [];
    let spokeCodes: SpokeKey[] = [];
    let boundaryTimes: number[] = [];

    $: {
        const times: number[] = [];
        const codes: SpokeKey[] = [];

        for (let i = 0; i < 17; i++) {
            const s = spokes.find(x => x.index === i);
            if (s && Number.isFinite(s.ts)) {
                times[i] = ms(s.ts);
                codes[i] = (s.code ?? (i === 16 ? 'E_next' : (labels[i] as any))) as SpokeKey;
            } else {
                times[i] = NaN;
                codes[i] = (i === 16 ? 'E_next' : (labels[i] as any)) as SpokeKey;
            }
        }

        spokeTimes = times;
        spokeCodes = codes;

        const bt: number[] = [];
        for (let i = 0; i < 16; i++) {
            const a = spokeTimes[i];
            const b = spokeTimes[i + 1];
            bt[i] = (Number.isFinite(a) && Number.isFinite(b)) ? ms((a + b) / 2) : NaN;
        }
        boundaryTimes = bt;
    }

    function nearestSpokeIndexByTime(ts0: number, arr: number[]) {
        let bestI = 0;
        let bestD = Infinity;
        for (let i = 0; i < arr.length; i++) {
            const t = arr[i];
            if (!Number.isFinite(t)) continue;
            const d = Math.abs(ts0 - t);
            if (d < bestD) { bestD = d; bestI = i; }
        }
        return bestI;
    }

    $: activeSpokeIndex = spokeTimes?.length ? nearestSpokeIndexByTime(effTs, spokeTimes) : 0;
    $: activeSpokeCode = spokeCodes?.[activeSpokeIndex] ?? ((activeSpokeIndex === 16) ? 'E_next' : (labels[activeSpokeIndex] as any));

    // Pointer angle: map effTs into [E..E_next] => full turn
    $: pointerAngleDeg = (() => {
        const t0 = spokeTimes?.[0];
        const t1 = spokeTimes?.[16];
        if (!Number.isFinite(t0) || !Number.isFinite(t1) || !(t1 > t0)) return 0;
        const phase = Math.min(1, Math.max(0, (effTs - t0) / (t1 - t0)));
        const base = spokeAngleDeg(0);
        return base + phase * 360;
    })();

    function jumpTo(ts0: number, reason = 'jump') {
        if (!Number.isFinite(ts0)) return;
        onUserActivity();
        dbg.log(`${wheel?.wheelType} ${reason}`, { from: new Date(selectedTs).toISOString(), to: new Date(ms(ts0)).toISOString() });
        setSelectedTs(ms(ts0));
    }

    // Nav: use cycle window edges (no fancy animator yet)
    const SHIFT_EPS_MS = 1500;

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        const t0 = spokeTimes?.[0];
        const t1 = spokeTimes?.[16];
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) return;
        const probe = dir < 0 ? (t0 - SHIFT_EPS_MS) : (t1 + SHIFT_EPS_MS);
        jumpTo(probe, dir < 0 ? 'prevCycle' : 'nextCycle');
    }

    // ------------------------------------------------------------
    // Tooltip handlers for spokes + boundaries
    // ------------------------------------------------------------
    function handleSpokeActivate(i: number) {
        const t = spokeTimes[i];
        if (Number.isFinite(t)) jumpTo(t, `spoke:${i}`);
    }

    function handleBoundaryActivate(i: number) {
        const t = boundaryTimes[i];
        if (Number.isFinite(t)) jumpTo(t, `boundary:${i}`);
    }

    function handleMarkerPick(ts0: number) {
        jumpTo(ts0, `tipPick`);
        tip.closeNow();
    }

    // ------------------------------------------------------------
    // Markers (stub for now — we’ll wire to moments later)
    // ------------------------------------------------------------
    let markerClusters: MarkerCluster[] = [];
    markerClusters = [];
</script>

<section class="panel">
    <header class="top">
        <div class="left">
            <div class="title">{title || '(untitled)'}</div>

            <!-- you said you'll swap WheelControl call yourself; keeping structure same as Compass -->
            <WheelControl
                    type={wheel.wheelType}
                    roles={wheel.roles}
                    title={wheel.title}
                    baseObserver={wheel.observer}
                    baseTime={wheel.time}
                    baseWheelId={wheel.wheelId}
            />
        </div>

        <div class="right">
            <button
                    type="button"
                    class="navBtn"
                    title="Previous"
                    on:click={() => shiftCycle(-1)}
                    disabled={!solveOk}
            >←</button>

            <button
                    type="button"
                    class="navBtn"
                    title="Next"
                    on:click={() => shiftCycle(1)}
                    disabled={!solveOk}
            >→</button>

            <button type="button" class="navBtn" title="Docs" on:click={docs.openDocs}>i</button>

            <button
                    type="button"
                    class="navBtn danger"
                    title={canClose ? 'Close wheel' : 'Can’t close the last wheel of this type'}
                    aria-label="Close wheel"
                    disabled={!canClose}
                    on:click|stopPropagation={closeCycle}
            >×</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Cycle Wheel">
                    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

                    {#each Array(spokeCount) as _, i (i)}
                        {@const a = boundaryAngleDeg(i)}
                        {@const pA = polarToXY(rOuter * 0.96, a)}
                        {@const pB = polarToXY(rOuter * 1.1, a)}
                        {@const pHit = polarToXY(rOuter, a)}
                        {@const tB = boundaryTimes?.[i]}
                        {@const boundaryTip = buildMomentTip(`boundary:${labels[i]}→${labels[(i + 1) % spokeCount]}`, tB, 'boundary')}
                        {@const boundaryKey = `boundary:${i}`}

                        <g
                                class="tick"
                                role="button"
                                tabindex="0"
                                aria-label={`House boundary ${i + 1}`}
                                on:click={(e) => tip.openMomentNow(e, boundaryTip)}
                                on:dblclick={() => handleBoundaryActivate(i)}
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
                        {@const tS = spokeTimes?.[i]}
                        {@const spokeTip = buildMomentTip(String(label), tS, 'spoke')}
                        {@const spokeKey = `spoke:${i}`}
                        {@const isActive = i === activeSpokeIndex}

                        <g
                                class="spoke"
                                role="button"
                                tabindex="0"
                                aria-label={`Spoke ${label}`}
                                on:click={(e) => tip.openMomentNow(e, spokeTip)}
                                on:dblclick={() => handleSpokeActivate(i)}
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
                                    stroke-opacity={isActive ? 0.9 : 0.35}
                                    stroke-width={i % 4 === 0 ? 4 : 2}
                                    stroke-linecap="round"
                            />

                            <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={VB * 0.046}
                                    fill="transparent"
                                    stroke="currentColor"
                                    class="spokeHalo"
                                    class:activeHalo={isActive}
                            />

                            <text
                                    class="spokeLabel"
                                    x={pt.x} y={pt.y}
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={VB * 0.035}
                                    fill="currentColor"
                                    fill-opacity={isActive ? 1 : 0.65}
                            >
                                {label}
                            </text>

                            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                        </g>
                    {/each}

                    {#each markerClusters as c (c.id)}
                        {@const a = c.angleDeg}
                        {@const rMark = rInner + (rOuter - rInner) * (c.orbit ?? 0.6)}
                        {@const p = polarToXY(rMark, a)}
                        {@const markerKey = `marker:${c.id}`}

                        <g
                                class="marker"
                                data-marker="1"
                                transform={`translate(${p.x} ${p.y})`}
                                on:click={(e) => tip.handleClusterClick(e, c)}
                                on:mouseenter={(e) => { if (!isCoarsePointer) tip.hoverClusterEnter(e, c, markerKey); }}
                                on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                                on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}
                        >
                            <circle r={VB * 0.035} fill="transparent" />
                            <circle r={VB * 0.02} fill={c.bg} stroke="currentColor" stroke-opacity="0.45" stroke-width="3" />
                            <circle r={VB * 0.018} fill="none" stroke="var(--bg)" stroke-opacity="0.5" stroke-width="2" />
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
                        <g class="pointer" style={`transform: rotate(${safeAngle(pointerAngleDeg, 0)}deg);`}>
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
                        onClose={tip.closeNow}/>
            {/if}
        </section>
    </div>

    <div class="info">
        <div class="infoRow">
            <button
                    class="jump"
                    type="button"
                    title={solveOk ? `Go to ${activeSpokeCode}` : solveReason || 'Solve failed'}
                    disabled={!solveOk}
                    on:click={() => {
                      const t = spokeTimes?.[activeSpokeIndex];
                      if (Number.isFinite(t)) jumpTo(t, `activeSpoke:${activeSpokeCode}`);
                    }}>
                <strong class="k">Spoke:</strong>
                <span class="dt">{activeSpokeCode}</span>
                <span class="sep">—</span>
                <span class="desc">{solveOk ? formatDateTime(spokeTimes?.[activeSpokeIndex]) : (solveReason || 'No data')}</span>
            </button>
        </div>

        {#if isHorizon}
            <div class="infoRow">
                <div class="rowFill">
                    <LocationPicker
                            value={wheelLoc}
                            locked={observer.locked}
                            onChange={(loc, meta) => {
                              onUserActivity();
                              const patch: Partial<WheelObserverState> = {
                                locationId: meta.savedId,
                                locked: meta.lockOnApply ? true : observer.locked
                              };
                              dbg.log?.('Cycle.location.apply', { patch });
                              boardApi.updateWheelObserver(wheelId, patch, 'Cycle.location.apply');
                            }}
                            onToggleLock={(next) => {
                              onUserActivity();
                              boardApi.updateWheelObserver(wheelId, { locked: next }, 'Cycle.location.lock');
                           }}/>
                </div>
            </div>
        {/if}

        <div class="infoRow">
            <div class="rowFill">
                <TimePicker
                        value={time}
                        locked={time.locked}
                        liveNowTs={time.live ? (time.locked ? localLiveNowTs : globalTs) : null}
                        onChange={(next, meta) => {
                            onUserActivity();
                            const patch: Partial<WheelTimeState> =
                              next.live
                                ? { live: true, locked: meta.lockOnApply ? true : time.locked }
                                : { live: false, ts: next.ts ?? Date.now(), locked: meta.lockOnApply ? true : time.locked };
                            boardApi.updateWheelTime(wheelId, patch, 'Cycle.time.apply');
                        }}
                        onToggleLock={(next) => {
                            onUserActivity();
                            boardApi.updateWheelTime(wheelId, { locked: next }, 'Cycle.time.lock');
                        }}/>
            </div>
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
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .left { display: grid; gap: 10px; min-width: 0; }
    .title {
        font-size: 24px;
        font-weight: 650;
        opacity: 0.95;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .right { display: flex; gap: 10px; align-items: center; }

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
    .navBtn:disabled { opacity: 0.45; cursor: default; transform: none; }

    .navBtn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }

    .wrap { width: 100%; max-width: 100%; }

    .wheelPanel { display: grid; gap: 10px; width: 100%; justify-items: center; }

    .wheelBox {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: stretch;
        overflow: hidden;
    }

    .wheelBox svg { width: 100%; height: 100%; display: block; }
    svg { display: block; width: 100%; height: 100%; max-width: none; max-height: none; }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .tick { cursor: pointer; }
    .tickLine{
        stroke: currentColor;
        stroke-opacity: 0.32;
        stroke-width: 5;
        stroke-linecap: round;
        transition: stroke-opacity 120ms ease;
    }
    .tick:hover .tickLine { stroke-opacity: 0.75; }

    .spoke { cursor: pointer; user-select: none; }

    .spokeLabel {
        pointer-events: auto;
        cursor: pointer;
        transition: fill-opacity 120ms ease, font-weight 120ms ease;
    }
    .spoke:hover .spokeLabel {
        fill-opacity: 1;
        font-weight: 800;
    }

    /* Compass-like halos */
    .spokeHalo {
        stroke-opacity: 0.12;
        stroke-width: 2.5;
        filter: none;
        transition: stroke-opacity 120ms ease, filter 120ms ease;
    }
    .spokeHalo.activeHalo {
        stroke-opacity: 0.75;
        stroke-width: 4.5;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .spoke:hover .spokeHalo {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }

    .pointer {
        transition: transform 420ms ease;
        transform-origin: 0 0;
        will-change: transform;
    }

    .info {
        width: 100%;
        max-width: 100%;
        font-size: 18px;
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: 2px;
        margin-top: 12px;
    }

    .infoRow {
        display: grid;
        grid-template-columns: 1fr;
        align-items: center;
        gap: 10px;
        padding: 4px 6px;
        border-radius: 10px;
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 90%);
    }

    .jump {
        display: grid;
        grid-template-columns: 64px auto 18px 1fr;
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
    .jump:disabled { opacity: 0.55; cursor: default; }
    .jump:disabled:hover { background: transparent; }

    .k { text-align: right; opacity: 0.85; }
    .dt { font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0.95; font-weight: 900; }
    .sep { opacity: 0.65; }

    .desc {
        opacity: 0.6;
        font-weight: 700;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rowFill{
        min-width: 0;
        width: 100%;
        display: block;
    }

    .rowFill :global(> *) {
        width: 100%;
        min-width: 0;
        display: block;
    }
    .rowFill :global(> *) { margin: 0; }

    .infoRow :global(.face) {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
    }
</style>
