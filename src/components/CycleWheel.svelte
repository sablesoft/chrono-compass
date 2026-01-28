<!-- src/components/CycleWheel.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Wheel from './Wheel.svelte';
    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';

    import { getDayAnchors, angleFromDayAnchors } from '../lib/cycles/day';
    import { getMoonAnchors, angleFromMoonAnchors } from '../lib/cycles/moon';
    import { getYearAnchors, angleFromYearAnchors } from '../lib/cycles/year';
    import { getPlatoAnchors, angleFromPlatoAnchors, shiftPlatoCycle } from '../lib/cycles/plato';

    import { formatDateTime, ms } from '../lib/format';
    import type { CycleKind, SpinCmd, PreTurnCmd } from '../lib/cycles/types';
    import { SPOKE_DESC } from '../lib/cycles/labels';

    import { startLive, isLive } from '../lib/stores/time';
    import { get } from 'svelte/store';

    export let kind: CycleKind = 'day';
    export let title = 'Day';

    export let lat: number;
    export let lon: number;

    export let selectedTs: number;
    export let onSelectTs: (ts: number) => void = () => {};
    export let onUserActivity: () => void = () => {};

    export let resetUiId = 0;

    // UI state (local per wheel)
    let selectedSpokeIndex: number | null = null;
    let activeSpokeIndex: number | null = null;

    // commands to Wheel
    let spinCmd: SpinCmd | null = null;
    let spinCmdId = 0;

    let preTurnCmd: PreTurnCmd | null = null;
    let preTurnCmdId = 0;

    let isCycling = false;

    // Responsive
    let wrapEl: HTMLDivElement | null = null;
    let ro: ResizeObserver | null = null;
    let wheelSize = 360;

    // derived
    let anchors: Anchors;
    let spokeTimes: number[] = [];
    let pointerAngleDeg = 0;
    let progress = 0;

    // time direction for Wheel (future => CCW, past => CW)
    let timeDir: -1 | 0 | 1 = 0;

    const ANIM_MS = 420;
    const SHIFT_EPS_MS = 1; // critical for boundary no-op bugs

    let unlockTimer: ReturnType<typeof setTimeout> | null = null;
    let nextETimer: ReturnType<typeof setTimeout> | null = null;

    // --- self-change marker (critical!)
    let pendingSelfTs: number | null = null;
    let lastSeenTs = selectedTs;

    let nowTs = ms(Date.now());

    let nowTimer: ReturnType<typeof setInterval> | null = null;
    let nowAlignTimer: ReturnType<typeof setTimeout> | null = null;

    // --- house boundaries (midpoints between spokes) ---
    const SPOKES = 16;

    function wrapIntoCycle(ts: number, cycleStart: number, cycleMs: number) {
        // bring ts into [cycleStart .. cycleStart+cycleMs)
        let x = ts;
        while (x < cycleStart) x += cycleMs;
        while (x >= cycleStart + cycleMs) x -= cycleMs;
        return ms(x);
    }

    function midpointInCycle(a: number, b: number, cycleStart: number, cycleMs: number) {
        let b2 = b;
        if (b2 < a) b2 += cycleMs;     // unwrap across end
        const mid = a + (b2 - a) / 2;
        return wrapIntoCycle(mid, cycleStart, cycleMs);
    }

    let boundaryTimes: number[] = []; // length 16, boundary[i] between spoke i and i+1

    $: {
        const cycleMs = Math.max(1, anchors.end - anchors.start);

        boundaryTimes = Array.from({ length: SPOKES }, (_, i) => {
            const a = spokeTimes[i];
            const b = spokeTimes[(i + 1) % SPOKES];
            return midpointInCycle(a, b, anchors.start, cycleMs);
        });
    }

    function onSelectBoundary(i: number) {
        onUserActivity();
        cancelLocalAnimationsAndUi();
        emitSelectTs(boundaryTimes[i]);
    }

    function houseStartTs(i: number) {
        if (i === 0) {
            // special: start of E house is midpoint between prev-cycle ESE and current E
            const prevBase = prevCycleStart(anchors);
            const aPrev = computeAnchors(prevBase);
            const spokesPrev = buildSpokeTimes(aPrev);

            const prevESE = spokesPrev[15];   // ESE in previous cycle
            const curE = spokeTimes[0];       // E in current cycle

            // midpoint between prevESE and curE (curE is "after" prevESE chronologically)
            return ms((prevESE + curE) / 2);
        }

        return boundaryTimes[(i - 1 + SPOKES) % SPOKES];
    }

    function houseEndTs(i: number) {
        // end boundary is between this spoke and next spoke
        return boundaryTimes[i];
    }

    function jumpTo(ts: number) {
        onUserActivity();
        cancelLocalAnimationsAndUi();
        emitSelectTs(ts);
    }

    function clearNowTimers() {
        if (nowAlignTimer) { clearTimeout(nowAlignTimer); nowAlignTimer = null; }
        if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
    }

    function startNowTicker() {
        // обновление 1 раз в минуту, с выравниванием на границу минуты
        clearNowTimers();
        nowTs = ms(Date.now());

        const now = Date.now();
        const msToNextMinute = 60_000 - (now % 60_000);

        nowAlignTimer = setTimeout(() => {
            nowTs = ms(Date.now());
            nowTimer = setInterval(() => {
                nowTs = ms(Date.now());
            }, 60_000);
        }, msToNextMinute + 5);
    }

    function clearTimers() {
        if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
        if (nextETimer) { clearTimeout(nextETimer); nextETimer = null; }
    }

    function cancelLocalAnimationsAndUi() {
        clearTimers();
        isCycling = false;
        spinCmd = null;
        preTurnCmd = null;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;
    }

    function emitSelectTs(ts: number) {
        const t = ms(ts);
        pendingSelfTs = t;
        onSelectTs(t);
    }

    function computeAnchors(ts: number): Anchors {
        if (kind === 'moon') return getMoonAnchors(ts);
        if (kind === 'year') return getYearAnchors(ts, lat, lon);
        if (kind === 'plato') return getPlatoAnchors(ts);
        return getDayAnchors(ts, lat, lon);
    }

    function computeAngle(ts: number, a: Anchors): number {
        if (kind === 'moon') return angleFromMoonAnchors(ts, a);
        if (kind === 'year') return angleFromYearAnchors(ts, a);
        if (kind === 'plato') return angleFromPlatoAnchors(ts, a);
        return angleFromDayAnchors(ts, a);
    }

    function prevCycleStart(a: Anchors) {
        if (kind === 'plato') return shiftPlatoCycle(a.E, -1);
        const aPrev = computeAnchors(a.E - SHIFT_EPS_MS);
        return aPrev.E;
    }

    function nextCycleStart(a: Anchors) {
        if (kind === 'plato') return shiftPlatoCycle(a.E, +1);
        return a.E_next;
    }

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        preTurnCmd = null;

        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        // IMPORTANT: step inside target cycle, not on boundary
        let shiftedBase: number;
        if (dir > 0) shiftedBase = nextCycleStart(anchors) + SHIFT_EPS_MS;
        else shiftedBase = prevCycleStart(anchors) + SHIFT_EPS_MS;

        const a2 = computeAnchors(shiftedBase);
        const t2 = buildSpokeTimes(a2);

        const targetTs = ms(t2[i]);
        const targetAngleDeg = computeAngle(targetTs, a2);

        if (ms(targetTs) === ms(selectedTs)) {
            console.warn(`[${title}/${kind}] shiftCycle no-op (same targetTs)`, { targetTs, selectedTs, shiftedBase });
            isCycling = false;
            return;
        }

        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };
        emitSelectTs(targetTs);

        clearTimers();
        unlockTimer = setTimeout(() => {
            isCycling = false;
            unlockTimer = null;
        }, ANIM_MS + 30);
    }

    // resetUiId => explicit reset
    let lastResetUiId = 0;
    $: if (resetUiId !== lastResetUiId) {
        lastResetUiId = resetUiId;
        cancelLocalAnimationsAndUi();
        timeDir = 0;
        lastSeenTs = selectedTs;
        pendingSelfTs = null;
    }

    // detect selectedTs changes, compute timeDir, inject preTurn ONLY for external big jumps
    $: {
        if (selectedTs === lastSeenTs) {
            timeDir = 0;
        } else {
            const oldTs = lastSeenTs;
            const delta = selectedTs - oldTs;
            const absDelta = Math.abs(delta);

            timeDir = delta > 0 ? 1 : -1;

            const isSelf = (pendingSelfTs === selectedTs);
            pendingSelfTs = null;

            lastSeenTs = selectedTs;

            if (!isCycling) {
                if (!isSelf) {
                    cancelLocalAnimationsAndUi();

                    const aNow = computeAnchors(selectedTs);
                    const cycleMs = Math.max(1, aNow.end - aNow.start);

                    preTurnCmd = absDelta > cycleMs
                        ? { id: ++preTurnCmdId, dir: timeDir > 0 ? 1 : -1 }
                        : null;
                }
            }
        }
    }

    // recompute derived
    $: anchors = computeAnchors(selectedTs);
    $: spokeTimes = buildSpokeTimes(anchors);
    $: pointerAngleDeg = computeAngle(selectedTs, anchors);
    $: progress = progressLinear(selectedTs, anchors.start, anchors.end);

    let showNowPointer = false;
    let nowPointerAngleDeg: number | null = null;

    $: {
        const live = get(isLive);

        if (live) {
            showNowPointer = false;
            nowPointerAngleDeg = null;
        } else {
            // now должен быть внутри текущего цикла этого колеса (anchors от selectedTs)
            const inside = nowTs >= anchors.start && nowTs <= anchors.end;
            showNowPointer = inside;
            nowPointerAngleDeg = inside ? computeAngle(nowTs, anchors) : null;
        }
    }

    function recomputeWheelSize() {
        if (!wrapEl) return;

        const style = getComputedStyle(wrapEl);
        const pl = parseFloat(style.paddingLeft) || 0;
        const pr = parseFloat(style.paddingRight) || 0;
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;

        const innerW = Math.max(0, wrapEl.clientWidth - pl - pr);
        const innerH = Math.max(0, wrapEl.clientHeight - pt - pb);
        const available = Math.floor(Math.min(innerW, innerH));

        const sizeByPad = Math.floor(available / 1.10);
        wheelSize = Math.max(320, sizeByPad - 2);
    }

    let usingWindowResize = false;

    onMount(() => {
        queueMicrotask(recomputeWheelSize);
        startNowTicker();

        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(recomputeWheelSize);
            ro.observe(wrapEl);
        } else {
            usingWindowResize = true;
            window.addEventListener('resize', recomputeWheelSize);
        }
    });

    onDestroy(() => {
        clearTimers();
        clearNowTimers();
        if (ro && wrapEl) ro.unobserve(wrapEl);
        ro?.disconnect();
        if (usingWindowResize) window.removeEventListener('resize', recomputeWheelSize);
    });

    function onSelectSpoke(i: number) {
        onUserActivity();
        cancelLocalAnimationsAndUi();

        selectedSpokeIndex = i;
        activeSpokeIndex = i;

        emitSelectTs(spokeTimes[i]);
    }

    function onSelectNextE() {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        clearTimers();

        const endTs = anchors.E_next;
        const endMinus1 = endTs - SHIFT_EPS_MS;

        preTurnCmd = null;
        spinCmd = null;

        emitSelectTs(endMinus1);

        nextETimer = setTimeout(() => {
            emitSelectTs(endTs);
            selectedSpokeIndex = 0;
            activeSpokeIndex = 0;
            isCycling = false;
            nextETimer = null;
        }, ANIM_MS);
    }
</script>

<section class="panel">
    <header class="top">
        <div class="left">
            <div class="title">{title}</div>
            <div class="sub">{(progress * 100).toFixed(1)}%</div>
        </div>

        <div class="right">
            <button type="button"
                    class="navBtn"
                    title={`Previous ${title}`}
                    on:click={() => shiftCycle(-1)}
                    disabled={isCycling}>←</button>

            <button type="button"
                    class="navBtn"
                    title={`Next ${title}`}
                    on:click={() => shiftCycle(1)}
                    disabled={isCycling}>→</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <Wheel
                size={wheelSize}
                selectedSpokeIndex={selectedSpokeIndex}
                pointerAngleDeg={pointerAngleDeg}
                spinCmd={spinCmd}
                preTurnCmd={preTurnCmd}
                timeDir={timeDir}
                onSelectSpoke={onSelectSpoke}
                onSelectNextE={onSelectNextE}
                showNowPointer={showNowPointer}
                nowPointerAngleDeg={nowPointerAngleDeg}
                onClickNow={() => startLive()}
                onSelectBoundary={onSelectBoundary}
        />
    </div>

    <div class="info">
        <div class="infoRow">
            <strong class="k">E:</strong>
            <span class="dt">{formatDateTime(anchors.E)}</span>
            <span>—</span>
            <span class="desc">{SPOKE_DESC[kind].E}</span>

            <span class="houseBtns">
                <button
                        type="button"
                        class="hb"
                        title={`House start: ${formatDateTime(houseStartTs(0))}`}
                        on:click={() => jumpTo(houseStartTs(0))}>
                  start
                </button>
                <button
                        type="button"
                        class="hb"
                        title={`House end: ${formatDateTime(houseEndTs(0))}`}
                        on:click={() => jumpTo(houseEndTs(0))}>
                  end
                </button>
            </span>
        </div>
        <div class="infoRow">
            <strong class="k">N:</strong>
            <span class="dt">{formatDateTime(anchors.N)}</span>
            <span>—</span>
            <span class="desc">{SPOKE_DESC[kind].N}</span>
            <span class="houseBtns">
                <button
                        type="button"
                        class="hb"
                        title={`House start: ${formatDateTime(houseStartTs(4))}`}
                        on:click={() => jumpTo(houseStartTs(4))}>
                  start
                </button>
                <button
                        type="button"
                        class="hb"
                        title={`House end: ${formatDateTime(houseEndTs(4))}`}
                        on:click={() => jumpTo(houseEndTs(4))}>
                  end
                </button>
            </span>
        </div>
        <div class="infoRow">
            <strong class="k">W:</strong>
            <span class="dt">{formatDateTime(anchors.W)}</span>
            <span>—</span>
            <span class="desc">{SPOKE_DESC[kind].W}</span>
            <span class="houseBtns">
                <button
                        type="button"
                        class="hb"
                        title={`House start: ${formatDateTime(houseStartTs(8))}`}
                        on:click={() => jumpTo(houseStartTs(8))}>
                  start
                </button>
                <button
                        type="button"
                        class="hb"
                        title={`House end: ${formatDateTime(houseEndTs(8))}`}
                        on:click={() => jumpTo(houseEndTs(8))}>
                  end
                </button>
            </span>
        </div>
        <div class="infoRow">
            <strong class="k">S:</strong>
            <span class="dt">{formatDateTime(anchors.S)}</span>
            <span>—</span>
            <span class="desc">{SPOKE_DESC[kind].S}</span>
            <span class="houseBtns">
                <button
                        type="button"
                        class="hb"
                        title={`House start: ${formatDateTime(houseStartTs(12))}`}
                        on:click={() => jumpTo(houseStartTs(12))}>
                  start
                </button>
                <button
                        type="button"
                        class="hb"
                        title={`House end: ${formatDateTime(houseEndTs(12))}`}
                        on:click={() => jumpTo(houseEndTs(12))}>
                  end
                </button>
            </span>
        </div>
        <div class="infoRow">
            <strong class="k">E+:</strong>
            <span class="dt">{formatDateTime(anchors.E_next)}</span>
            <span>—</span>
            <span class="desc">{SPOKE_DESC[kind].E_next}</span>
        </div>
    </div>
</section>

<style>
    .panel {
        border: 1px solid var(--panel-border);
        background: var(--panel);
        border-radius: 18px;
        padding: 18px;
        overflow: hidden;
    }

    .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
    }

    .title {
        font-size: 24px;
        font-weight: 650;
        opacity: 0.95;
    }

    .sub {
        font-size: 14px;
        opacity: 0.75;
        margin-top: 2px;
    }

    .right {
        display: flex;
        gap: 10px;
    }

    button {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
    }
    button:disabled { opacity: 0.45; cursor: default; }

    .wrap {
        display: grid;
        place-items: center;
        padding: 12px;
        aspect-ratio: 1 / 1;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
    }

    .info {
        margin-top: 10px;
        font-size: 18px;
        line-height: 1.75;
        opacity: 0.82;
        display: grid;
        gap: 6px;
    }

    .infoRow {
        display: grid;
        grid-template-columns: 3ch 15ch 2ch 1fr 120px;
        align-items: center;
        column-gap: 10px;
        padding: 2px 6px;
        border-radius: 6px;
    }

    .infoRow .k { text-align: right; opacity: 0.85; }
    .infoRow .dt { font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0.95; }
    .infoRow .desc { opacity: 0.6; font-weight: bold; }

    .infoRow:hover {
        background: var(--hover, rgba(255,255,255,0.04));
    }
    .houseBtns{
        display: inline-flex;
        justify-content: flex-end;
        gap: 8px;
    }

    .hb{
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-size: 14px;
        font-weight: 800;
        opacity: 0.9;
    }
    .hb:hover{
        opacity: 1;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
    }
    .navBtn{
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    .navBtn:hover:not(:disabled){
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }

    .navBtn:active:not(:disabled){
        transform: translateY(0px);
    }

    .navBtn:focus-visible{
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 65%);
        outline-offset: 3px;
    }

    .navBtn:disabled{
        opacity: 0.45;
        cursor: default;
        transform: none;
    }
</style>