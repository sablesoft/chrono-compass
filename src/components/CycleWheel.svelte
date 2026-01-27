<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Wheel from './Wheel.svelte';

    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';

    import { getDayAnchors, angleFromDayAnchors, shiftDayCycle } from '../lib/cycles/day';
    import { getMoonAnchors, angleFromMoonAnchors, shiftMoonCycle } from '../lib/cycles/moon';

    import { formatDateTime } from '../lib/format';
    import type { CycleKind, SpinCmd } from '../lib/cycles/types';

    const ANIM_MS = 420;

    export let kind: CycleKind = 'day';
    export let title = 'Day';

    export let lat: number;
    export let lon: number;

    // single source of truth lives in App
    export let selectedTs: number;

    // emit change of global time
    export let onSelectTs: (ts: number) => void = () => {};

    // UI state (local per wheel)
    let selectedSpokeIndex: number | null = null;
    let activeSpokeIndex: number | null = null;

    let spinCmd: SpinCmd | null = null;
    let spinCmdId = 0;

    let isCycling = false;

    // DOM
    let wrapEl: HTMLDivElement | null = null;
    let ro: ResizeObserver | null = null;

    // Responsive size
    let wheelSize = 360;

    export let resetUiId = 0;
    let lastResetUiId = 0;

    // timers we want to be able to cancel
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;
    let nextETimer: ReturnType<typeof setTimeout> | null = null;

    // derived
    let anchors: Anchors;
    let spokeTimes: number[] = [];
    let pointerAngleDeg = 0;
    let progress = 0;

    // direction of time (for Wheel “time-directed rotation”)
    let prevTs = selectedTs;
    let timeDir: -1 | 0 | 1 = 0;

    function clearTimers() {
        if (unlockTimer) {
            clearTimeout(unlockTimer);
            unlockTimer = null;
        }
        if (nextETimer) {
            clearTimeout(nextETimer);
            nextETimer = null;
        }
    }

    function resetUiOnly() {
        clearTimers();
        selectedSpokeIndex = null;
        activeSpokeIndex = null;
        spinCmd = null;
        isCycling = false;
    }

    function computeAnchors(ts: number): Anchors {
        if (kind === 'moon') return getMoonAnchors(ts);
        // year пока заглушка: day
        return getDayAnchors(ts, lat, lon);
    }

    function computeAngle(ts: number, a: Anchors): number {
        if (kind === 'moon') return angleFromMoonAnchors(ts, a);
        // year пока заглушка: day
        return angleFromDayAnchors(ts, a);
    }

    function computeShiftedBase(cycleStartTs: number, dir: -1 | 1): number {
        if (kind === 'moon') return shiftMoonCycle(cycleStartTs, dir);
        // year пока заглушка: day
        return shiftDayCycle(cycleStartTs, dir);
    }

    // detect direction of the *incoming* global time changes
    $: {
        if (selectedTs === prevTs) {
            timeDir = 0;
        } else {
            timeDir = selectedTs > prevTs ? 1 : -1;
            prevTs = selectedTs;
        }
    }

    // external reset (Now button in App)
    $: if (resetUiId !== lastResetUiId) {
        lastResetUiId = resetUiId;
        resetUiOnly();
    }

    // derived model for this wheel
    $: anchors = computeAnchors(selectedTs);
    $: spokeTimes = buildSpokeTimes(anchors);
    $: pointerAngleDeg = computeAngle(selectedTs, anchors);
    $: progress = progressLinear(selectedTs, anchors.start, anchors.end);

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

        // Wheel uses internal padding visually; in our fixed VB version it’s mostly about container.
        // Still keep the small “breathing room” factor.
        const sizeByPad = Math.floor(available / 1.10);

        wheelSize = Math.max(320, sizeByPad - 2);
    }

    onMount(() => {
        queueMicrotask(() => recomputeWheelSize());

        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(() => recomputeWheelSize());
            ro.observe(wrapEl);
        } else {
            window.addEventListener('resize', recomputeWheelSize);
        }
    });

    onDestroy(() => {
        clearTimers();
        if (ro && wrapEl) ro.unobserve(wrapEl);
        ro?.disconnect();
        window.removeEventListener('resize', recomputeWheelSize);
    });

    function onSelectSpoke(i: number) {
        // user action overrides any pending animation state
        clearTimers();
        isCycling = false;
        spinCmd = null;

        selectedSpokeIndex = i;
        activeSpokeIndex = i;

        onSelectTs(spokeTimes[i]);
    }

    function shiftCycle(dir: -1 | 1) {
        if (isCycling) return;

        clearTimers();
        isCycling = true;

        // 1) choose which spoke to preserve across cycles
        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        // 2) compute next cycle anchors (IMPORTANT: shift from cycle start)
        const shiftedBase = computeShiftedBase(anchors.E, dir);
        const a2 = computeAnchors(shiftedBase);
        const t2 = buildSpokeTimes(a2);

        const targetTs = t2[i];
        const targetAngleDeg = computeAngle(targetTs, a2);

        // 3) command Wheel: 1 full turn + land on targetAngleDeg
        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };

        // 4) update global time
        onSelectTs(targetTs);

        // unlock after animation
        unlockTimer = setTimeout(() => {
            isCycling = false;
            unlockTimer = null;
        }, ANIM_MS + 30);
    }

    function onSelectNextE() {
        if (isCycling) return;

        clearTimers();
        isCycling = true;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        // animate to end-of-cycle (just before E_next)
        onSelectTs(anchors.end - 1);

        // snap to next cycle start (exact E_next)
        nextETimer = setTimeout(() => {
            onSelectTs(anchors.end);
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
            <div class="sub">
                {formatDateTime(selectedTs)} · {(progress * 100).toFixed(1)}%
            </div>
        </div>

        <div class="right">
            <button on:click={() => shiftCycle(-1)} disabled={isCycling}>←</button>
            <button on:click={() => shiftCycle(1)} disabled={isCycling}>→</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <Wheel
                size={wheelSize}
                selectedSpokeIndex={selectedSpokeIndex}
                pointerAngleDeg={pointerAngleDeg}
                spinCmd={spinCmd}
                timeDir={timeDir}
                onSelectSpoke={onSelectSpoke}
                onSelectNextE={onSelectNextE}
        />
    </div>

    <div class="info">
        <div><strong>E:</strong> {formatDateTime(anchors.E)}</div>
        <div><strong>N:</strong> {formatDateTime(anchors.N)}</div>
        <div><strong>W:</strong> {formatDateTime(anchors.W)}</div>
        <div><strong>S:</strong> {formatDateTime(anchors.S)}</div>
        <div><strong>E+:</strong> {formatDateTime(anchors.E_next)}</div>
    </div>
</section>

<style>
    .panel {
        border: 1px solid rgba(231, 231, 234, 0.12);
        background: rgba(231, 231, 234, 0.04);
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
        font-size: 22px;
        font-weight: 650;
        opacity: 0.95;
    }

    .sub {
        font-size: 18px;
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
        border: 1px solid rgba(231, 231, 234, 0.18);
        background: rgba(231, 231, 234, 0.06);
        color: inherit;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.45;
        cursor: default;
    }

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
        gap: 4px;
    }

    .info strong {
        font-weight: 650;
    }
</style>
