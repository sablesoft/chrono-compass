<!-- src/components/Compass.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';

    import { createWheelGeom, SPOKE_LABELS } from '../lib/wheel/geom';
    import { useWheelResponsive } from '../lib/wheel/ui/useWheelResponsive';
    import { useTooltip } from '../lib/wheel/ui/useTooltip';

    import DocsModal from './DocsModal.svelte';
    import CompassTooltip from './CompassTooltip.svelte';
    import LocationPicker from './LocationPicker.svelte';
    import TimePicker from './TimePicker.svelte';

    import { useDocs } from '../lib/docs';
    import { debug } from '../lib/debug';
    import { ms } from '../lib/format';

    import { bodies } from '../lib/catalog';
    import type { BodyId } from '../lib/catalog';

    import type { MarkerCluster, MarkerItem, MomentTip } from '../lib/wheel/wheel';
    import { compassClusters } from '../lib/wheel/ui/compassClusters';

    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';
    import { solveWheel } from '../lib/board/dispatcher';
    import type { WheelSolveResult } from '../lib/board/runtime';

    import {DEFAULT_LOCATION_ID, type Location} from '../lib/location/types';
    import type { WheelObserverState, WheelTimeState } from '../lib/wheel/types';

    import { selectedTs as globalSelectedTs, isLive as globalIsLive } from '../lib/time/store';

    import { compassTargetsToMarkerItems } from '../lib/math/compass';
    import type { CompassTargetState } from '../lib/math/compass';
    import {norm360} from "../lib/math/helpers";
    import WheelHeader from "./WheelHeader.svelte";

    // ------------------------------------------------------------
    // Props (NEW contract: Board passes wheel + location)
    // ------------------------------------------------------------
    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: Location;
    export let onUserActivity: () => void = () => {};

    const dbg = debug('COMPASS', '🧭');

    // docs
    const docs = useDocs(() => 'concept/compass.md', {
        getTitle: () => 'Compass Wheel',
        dbg,
        tag: () => 'compass'
    });
    const docsState = docs.state;

    // ------------------------------------------------------------
    // Local derived state from wheel
    // ------------------------------------------------------------
    $: wheelId = wheel?.wheelId;
    $: roles = (wheel?.roles ?? {}) as any;
    $: title = wheel?.title ?? '';

    $: observer = (wheel?.observer ?? { locationId: DEFAULT_LOCATION_ID, locked: false }) as WheelObserverState;
    $: time = (wheel?.time ?? { live: true, locked: false }) as WheelTimeState;

    // prefer passed-in location (already resolved in Board)
    $: wheelLoc = location;
    $: wheelLat = wheelLoc?.lat;
    $: wheelLon = wheelLoc?.lon;

    function closeCompass() {
        onUserActivity();
        boardApi.removeWheelById(wheelId, 'Compass.close');
    }

    // ------------------------------------------------------------
    // Time sync: global <-> wheel time
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
                    'Compass.syncWheelTime'
                );
            }
        }
    }

    // If observer isn't locked -> keep it synced to passed-in location (board already chose it)
    // (We don't read global location store anymore in Compass; Board is the boss now.)
    $: {
        if (wheelId)
            if (!observer?.locked && wheelLoc?.id && observer.locationId !== wheelLoc.id) {
                boardApi.updateWheelObserver(wheelId, { locationId: wheelLoc.id }, 'Compass.syncObserverLocation');
            }
    }

    // ------------------------------------------------------------
    // Geometry
    // ------------------------------------------------------------
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

    function orbitToRadiusVB(orbit: number) {
        const o = Math.max(0, orbit);
        if (o <= 1) return rHorizon * o;
        const t = Math.min(1, o - 1);
        return rHorizon + (rOuter - rHorizon) * t;
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

    // ------------------------------------------------------------
    // Marker clustering + pinning
    // ------------------------------------------------------------
    const MIN_ARC_PX = 28;
    let markerClusters: MarkerCluster[] = [];
    let lastTargets: CompassTargetState[] = [];

    let pinnedBodyId: BodyId | null = null;

    function clearPinned() {
        pinnedBodyId = null;
    }

    function togglePin(id: BodyId) {
        pinnedBodyId = (pinnedBodyId === id) ? null : id;
    }

    function clusterContainsPinned(c: MarkerCluster): boolean {
        if (!pinnedBodyId) return false;
        return c.items?.some(it => {
            const body = String(it.baseId ?? '').replace('body:', '');
            return body === pinnedBodyId;
        }) ?? false;
    }

    function clusterSingleBodyId(c: MarkerCluster): BodyId | null {
        if (!c || c.count !== 1) return null;
        const it = c.items?.[0];
        const body = String(it?.baseId ?? '').replace('body:', '');
        return (body ? (body as BodyId) : null);
    }

    function handleMarkerPick(ts0: number) {
        onUserActivity();
        tip.closeNow();
    }

    // ------------------------------------------------------------
    // Helpers: roles parsing
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // House mapping helpers
    // ------------------------------------------------------------

    function angDistDeg(a: number, b: number): number {
        const d = Math.abs(norm360(a) - norm360(b));
        return Math.min(d, 360 - d);
    }

    function nearestSpokeByAngle(angleDeg: number): number {
        let bestI = 0;
        let bestD = Infinity;
        for (let i = 0; i < spokeCount; i++) {
            const aSpoke = spokeAngleDeg(i);
            const d = angDistDeg(angleDeg, aSpoke);
            if (d < bestD) { bestD = d; bestI = i; }
        }
        return bestI;
    }

    function azimuthToWheelAngleDeg(azimuthDeg: number): number {
        let a = norm360(azimuthDeg - 90);
        if (a > 180) a -= 360;
        return a;
    }

    function houseLabelForAzimuth(azimuthDeg: number): string {
        const wheelAngle = azimuthToWheelAngleDeg(azimuthDeg);
        const i = nearestSpokeByAngle(wheelAngle);
        return labels[i] ?? '—';
    }

    function houseFromAzimuth(az: number): string {
        const wdeg = azimuthToWheelAngleDeg(az);
        const i = nearestSpokeByAngle(wdeg);
        return labels[i] ?? '—';
    }

    // ------------------------------------------------------------
    // Solve via runtime dispatcher
    // ------------------------------------------------------------
    $: {
        const targets = asBodyIdArray((roles as any)?.target);
        const looker = asBodyIdOrNull((roles as any)?.looker) ?? 'Earth';

        if (!wheel || !wheelLoc || !targets.length || wheelLat == null || wheelLon == null) {
            markerClusters = [];
            lastTargets = [];
        } else {
            const ctx = {
                ts: effTs,
                location: wheelLoc,
                dbg: { log: dbg.log, warn: dbg.log, error: dbg.log }
            };

            const res: WheelSolveResult = solveWheel(wheel as any, ctx);

            if (!res || res.kind !== 'compass' || !res.ok) {
                markerClusters = [];
                lastTargets = [];
            } else {
                lastTargets = (res.bodies as CompassTargetState[]) ?? [];
                const items: MarkerItem[] = compassTargetsToMarkerItems(effTs, lastTargets, looker);
                markerClusters = compassClusters(items, orbitToRadiusVB, MIN_ARC_PX);
            }
        }
    }

    // table rows for tooltip / pinned row
    $: allBodies = lastTargets.map(t => {
        const b = (bodies as any)[t.id] as { emoji?: string; name?: { en?: string } } | undefined;
        const name = b?.name?.en ?? String(t.id);
        const emoji = b?.emoji ?? '•';
        const house = houseLabelForAzimuth(t.azimuthDeg);

        return {
            id: t.id,
            emoji,
            name,
            azimuthDeg: t.azimuthDeg,
            altitudeDeg: t.altitudeDeg,
            house,
            visible: t.altitudeDeg >= 0
        };
    });

    // occupied spokes: only if at least one visible body in that house
    let occupiedSpokes: boolean[] = [];
    $: {
        const occ = Array.from({ length: spokeCount }, () => false);
        for (const b of allBodies) {
            if (!b.visible) continue;
            const i = labels.indexOf(b.house as any);
            if (i >= 0) occ[i] = true;
        }
        occupiedSpokes = occ;
    }

    $: pinnedRow = (() => {
        if (!pinnedBodyId) return null;
        const t = lastTargets?.find((x) => x.id === pinnedBodyId);
        if (!t) return null;

        const emoji = (bodies as any)?.[pinnedBodyId]?.emoji ?? '•';
        const name = (bodies as any)?.[pinnedBodyId]?.name?.en ?? String(pinnedBodyId);

        return {
            id: pinnedBodyId,
            emoji,
            name,
            house: houseFromAzimuth(t.azimuthDeg),
            az: t.azimuthDeg,
            alt: t.altitudeDeg,
            visible: !!t.visible
        };
    })();

    function buildHouseTip(label: string): MomentTip {
        return { label, ts: effTs, desc: `house:${label}` };
    }

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

    function handleMarkerActivate(c: MarkerCluster) {
        dbg.log('Cluster Activate', c);
    }

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
    <WheelHeader wheel={wheel} onDocs={docs.openDocs} onClose={closeCompass}/>

    <!-- WHEEL SVG -->
    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">
            <div class="wheelBox">
                <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}
                     on:click={(e) => {
                      const t = e.target;
                      if (!(t instanceof Element)) return clearPinned();
                      if (t.closest('[data-marker], [data-tooltip-root]')) return;
                      clearPinned();
                    }}
                     aria-label="Compass Wheel">
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
                        {@const houseTip = buildHouseTip(label)}
                        {@const houseKey = `house:${label}`}

                        <g
                                class="spoke"
                                role="button"
                                tabindex="0"
                                aria-label={`House ${label}`}
                                on:click={(e) => tip.openMomentNow(e, houseTip)}
                                on:mouseenter={(e) => tip.hoverMomentEnter(e, houseTip, houseKey)}
                                on:mouseleave={() => tip.hoverLeave(houseKey)}
                        >
                            <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke="currentColor"
                                    stroke-opacity={0.35}
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
                                    class:occupied={occupiedSpokes[i]}
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
                        {@const isCluster = c.count > 1}
                        {@const o = c.opacity ?? 1}

                        <g class="marker"
                           class:pinnedMark={clusterContainsPinned(c)}
                           data-marker="1"
                           transform={`translate(${p.x} ${p.y})`}
                           style={`opacity:${c.opacity ?? 1}`}
                           on:click={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  const id = clusterSingleBodyId(c);
                                  if (id) {
                                    togglePin(id);
                                    tip.openClusterNow(e, c);
                                  } else {
                                    tip.openClusterNow(e, c);
                                  }
                                }}
                           on:mouseenter={(e) => { if (!isCoarsePointer) tip.hoverClusterEnter(e, c, markerKey); }}
                           on:mousemove={(e) => { if (!isCoarsePointer) tip.move(e); }}
                           on:mouseleave={() => { if (!isCoarsePointer) tip.hoverLeave(markerKey); }}
                        >
                            <circle r={VB * 0.035} fill="transparent" />

                            <circle
                                    r={VB * 0.02}
                                    fill="transparent"
                                    stroke="currentColor"
                                    stroke-opacity={0.28}/>
                            <text
                                    class="markerGlyph"
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size={VB * (isCluster ? 0.022 : 0.035)}
                                    font-weight={isCluster ? 900 : 850}
                                    letter-spacing={c.count === 1 ? 0 : 0.6}
                                    fill="currentColor"
                                    fill-opacity={Math.max(0.92, o)}
                                    stroke="currentColor"
                                    stroke-opacity={isCluster ? 0.35 : 0.55}
                                    stroke-width={isCluster ? 2.5 : 2}
                                    paint-order="stroke"
                                    style="pointer-events:none"
                            >
                                {c.count === 1 ? c.emoji : c.label}
                            </text>
                        </g>
                    {/each}

                    <circle cx={cx} cy={cy} r={VB * 0.006} class="zenith" />
                </svg>
            </div>

            {#if $tipState.open && ($tipState.cluster || $tipState.moment)}
                <CompassTooltip
                        x={$tipState.x}
                        y={$tipState.y}
                        cluster={$tipState.cluster}
                        moment={$tipState.moment}
                        allBodies={allBodies}
                        pinnedBodyId={pinnedBodyId}
                        onTogglePin={togglePin}
                        onPickTs={handleMarkerPick}
                        onMouseEnter={tip.keepOpen}
                        onMouseLeave={tip.scheduleClose}
                        onClose={tip.closeNow}
                />
            {/if}
        </section>
    </div>

    <!-- INFO -->
    <div class="info">
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

                          dbg.log?.('Compass.location.apply', { patch });
                          boardApi.updateWheelObserver(wheelId, patch, 'Compass.location.apply');
                        }}
                        onToggleLock={(next) => {
                          onUserActivity();
                          boardApi.updateWheelObserver(wheelId, { locked: next }, 'Compass.location.lock');
                        }}/>
            </div>
        </div>

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

                          boardApi.updateWheelTime(wheelId, patch, 'Compass.time.apply');
                        }}
                        onToggleLock={(next) => {
                          onUserActivity();
                          boardApi.updateWheelTime(wheelId, { locked: next }, 'Compass.time.lock');
                        }}/>
            </div>
        </div>

        <div class="infoRow pinnedRow" class:emptyPinned={!pinnedRow}>
            {#if pinnedRow}
                <div class="rowFill">
                    <div class="pinnedLine" title="Pinned body">
                        <span class="pE">{pinnedRow.emoji}</span>
                        <span class="pN">{pinnedRow.name}</span>
                        <span class="pH">{pinnedRow.house}</span>
                        <span class="pA">Az {pinnedRow.az.toFixed(1)}°</span>
                        <span class="pAlt">{pinnedRow.alt.toFixed(1)}°</span>
                    </div>
                </div>

                <button class="hb" type="button" title="Unpin" on:click={clearPinned}>×</button>
            {:else}
                <div class="rowFill">
                    <div class="pinnedLine muted" title="No pinned body">
                        <span class="pE">📌</span>
                        <span class="pN">No pinned body</span>
                        <span class="pH">—</span>
                        <span class="pA">Az —</span>
                        <span class="pAlt">Alt —</span>
                    </div>
                </div>
                <button class="hb" type="button" disabled title="Pin a body to see details">×</button>
            {/if}
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
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    .wrap {
        width: 100%;
        max-width: 100%;
        flex: 0 0 auto;
        min-height: 0;
    }

    .wheelPanel { display: grid; gap: 10px; width: 100%; justify-items: center; }
    .wheelBox { width: 100%; aspect-ratio: 1 / 1; display: grid; place-items: stretch; overflow: hidden; }
    .wheelBox svg { width: 100%; height: 100%; display: block; }
    svg { display: block; width: 100%; height: 100%; max-width: none; max-height: none; }

    .quadrants .q { fill-opacity: 0.16; stroke: none; }
    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }

    .tickLine{ stroke: currentColor; stroke-opacity: 0.32; stroke-width: 5; stroke-linecap: round; }
    .spokeLabel {
        pointer-events: auto;
        cursor: pointer;
        transition: fill-opacity 120ms ease, font-weight 120ms ease;
    }
    .spoke:hover .spokeLabel {
        fill-opacity: 1;
        font-weight: 800;
    }
    .spoke:focus {
        outline: none;
    }

    .spoke:focus-visible {
        outline: none;
    }
    .info {
        width: 100%;
        max-width: 100%;
        font-size: 18px;
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: 2px;
        margin-top: auto;   /* вот это магия “прилипни вниз” */
        min-height: 0;
        overflow: auto;
    }
    .infoRow { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 4px 6px; border-radius: 10px; }

    .infoRow{
        box-sizing: border-box;
        background: color-mix(in oklab, var(--panel), var(--fg) 2%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 90%);
    }

    .horizon { stroke: currentColor; stroke-opacity: 0.28; stroke-width: 6; }
    .zenith { fill: currentColor; opacity: 0.85; }

    .marker { cursor: pointer; }
    .marker:hover circle { stroke-opacity: 0.75; }

    .spoke { cursor: pointer; user-select: none; }

    .navBtn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }
    .marker.pinnedMark circle {
        stroke-opacity: 1;
        stroke-width: 5;
    }
    .marker.pinnedMark {
        filter:
                drop-shadow(0 0 14px color-mix(in oklab, var(--accent-live), transparent 35%))
                drop-shadow(0 0 22px color-mix(in oklab, var(--fg), transparent 70%));
        z-index: 2;
    }
    .marker.pinnedMark text {
        fill-opacity: 1;
        font-weight: 900;
    }
    .infoRow.pinnedRow{
        border: 0;
        background: color-mix(in oklab, var(--panel), var(--fg) 4%);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--fg), transparent 84%);
    }

    .infoRow.pinnedRow.emptyPinned {
        opacity: 0.55;
    }

    .pinnedLine.muted .pH {
        background: transparent;
        border: 2px dashed color-mix(in oklab, var(--fg), transparent 80%);
    }

    .pinnedLine {
        display: grid !important;
        grid-template-columns: auto 1fr auto auto auto;
        align-items: center;
        gap: 14px;
    }

    .pE{ font-size:20px; width:24px; text-align:center; }
    .pN{ font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pH{ font-weight:900; opacity:0.9; padding:2px 8px; border-radius:10px;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%); }
    .pA, .pAlt{ opacity:0.85; font-variant-numeric: tabular-nums; white-space:nowrap; }
    .rowFill{
        min-width: 0;
        width: 100%;
        display: block;
    }

    /* ключевой момент: тянем корневой DOM-элемент компонента */
    .rowFill :global(> *) {
        width: 100%;
        min-width: 0;
        display: block;
    }
    .rowFill :global(> *) { margin: 0; }
    /* Убираем "внутреннюю карточку" у пикеров */
    .infoRow :global(.face) {
        background: transparent !important;
        border: 0 !important;
        /*border-radius: 0 !important;*/
        box-shadow: none !important;
    }
    /* круг всегда есть, но по умолчанию “почти нет” */
    .spokeHalo {
        stroke-opacity: 0.12;
        stroke-width: 2.5;
        filter: none;
        transition: stroke-opacity 120ms ease, filter 120ms ease;
    }

    /* если в доме есть хотя бы одно тело над горизонтом — держим заметнее */
    .spokeHalo.occupied {
        stroke-opacity: 0.75;     /* было 0.55 */
        stroke-width: 4.5;        /* было 3 в разметке */
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }

    /* hover: подсветить круг (и для occupied, и для пустых) */
    .spoke:hover .spokeHalo {
        stroke-opacity: 0.9;
        filter: drop-shadow(0 0 8px color-mix(in oklab, var(--fg), transparent 55%));
    }
    .markerGlyph {
        filter:
                drop-shadow(0 0 2px color-mix(in oklab, var(--bg), transparent 0%))
                drop-shadow(0 0 5px color-mix(in oklab, var(--fg), transparent 60%));
    }
</style>
