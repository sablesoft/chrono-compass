<!-- src/components/CycleWheel.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Wheel from './Wheel.svelte';
    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';
    import { getDayAnchors, shiftDayCycle, angleFromDayAnchors } from '../lib/cycles/day';
    import { getMoonAnchors, shiftMoonCycle, angleFromMoonAnchors } from '../lib/cycles/moon';
    import { getYearAnchors, shiftYearCycle, angleFromYearAnchors } from '../lib/cycles/year';
    import { formatDateTime } from '../lib/format';
    import type { CycleKind, SpinCmd } from '../lib/cycles/types';

    // NOTE: Wheel exports this type in my snippet, but here we’ll just inline it
    // to avoid extra imports. If you exported it to lib/cycles/types.ts, import it instead.
    type PreTurnCmd = { id: number; dir: 1 | -1 };

    export let kind: CycleKind = 'day';
    export let title = 'Day';
    export let lat: number;
    export let lon: number;

    export let selectedTs: number;
    export let onSelectTs: (ts: number) => void = () => {};
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
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;
    let nextETimer: ReturnType<typeof setTimeout> | null = null;

    // --- important: detect external time jumps
    let selfChangeToken = 0; // increment before calling onSelectTs
    let lastSeenTs = selectedTs;

    // вместо токенов — надёжный флажок “это я сам поменял”
    let pendingSelfTs: number | null = null;

    function clearTimers() {
        if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
        if (nextETimer) { clearTimeout(nextETimer); nextETimer = null; }
    }

    function cancelLocalAnimationsAndUi() {
        clearTimers();
        isCycling = false;
        spinCmd = null;
        preTurnCmd = null;

        // при внешнем прыжке лучше гасить подсветку: иначе UI “врет”
        selectedSpokeIndex = null;
        activeSpokeIndex = null;
    }

    function emitSelectTs(ts: number) {
        selfChangeToken += 1;
        onSelectTs(ts);
    }

    function computeAnchors(ts: number): Anchors {
        if (kind === 'moon') return getMoonAnchors(ts);
        if (kind === 'year') return getYearAnchors(ts, lat, lon);
        return getDayAnchors(ts, lat, lon);
    }

    function computeAngle(ts: number, a: Anchors): number {
        if (kind === 'moon') return angleFromMoonAnchors(ts, a);
        if (kind === 'year') return angleFromYearAnchors(ts, a);
        return angleFromDayAnchors(ts, a);
    }

    function shiftCycleBase(baseTs: number, dir: -1 | 1): number {
        if (kind === 'moon') return shiftMoonCycle(baseTs, dir);
        if (kind === 'year') return shiftYearCycle(baseTs, dir);
        return shiftDayCycle(baseTs, dir);
    }

    // resetUiId => явный сброс
    let lastResetUiId = 0;
    $: if (resetUiId !== lastResetUiId) {
        lastResetUiId = resetUiId;
        cancelLocalAnimationsAndUi();
        timeDir = 0;
    }

    // detect external selectedTs changes + compute timeDir + pre-turn for big jumps
    $: {
        if (selectedTs === lastSeenTs) {
            timeDir = 0;
        } else {
            const oldTs = lastSeenTs;
            const delta = selectedTs - oldTs;

            // direction from old -> new
            timeDir = delta > 0 ? 1 : -1;

            // who initiated the change?
            const isSelf = pendingSelfTs === selectedTs;
            const isExternal = !isSelf;
            pendingSelfTs = null;

            // update last seen BEFORE any further logic depends on "current state"
            lastSeenTs = selectedTs;

            // if this wheel is currently doing its own ←/→ animation, don't inject preturn
            if (!isCycling) {
                // if external (another wheel / Now / manual date picker later) — drop local UI so we don't lie
                if (isExternal) {
                    cancelLocalAnimationsAndUi();
                }

                // big jump detection: compare using oldTs (NOT lastSeenTs after update)
                const a = computeAnchors(selectedTs);
                const cycleMs = Math.max(1, a.end - a.start);
                const absDelta = Math.abs(delta);

                if (absDelta > cycleMs) {
                    // one full cycle + to E + to target, in the same time direction
                    preTurnCmd = { id: ++preTurnCmdId, dir: timeDir > 0 ? 1 : -1 };
                } else {
                    preTurnCmd = null;
                }
            }
        }
    }

    // The above block can’t compute absDelta after overwriting. Use a separate stable tracker:
    let lastTsForJumpCheck = selectedTs;
    $: {
        if (selectedTs !== lastTsForJumpCheck) {
            const delta = selectedTs - lastTsForJumpCheck;
            const absDelta = Math.abs(delta);

            // We already compute anchors reactively below, but for pre-turn we need duration now:
            const aNow = computeAnchors(selectedTs);
            const cycleMs = Math.max(1, aNow.end - aNow.start);

            // Only when:
            // - change is bigger than one cycle
            // - we have a direction
            // - we are not in our own ←/→ animation lock
            if (!isCycling && timeDir !== 0 && absDelta > cycleMs) {
                preTurnCmd = { id: ++preTurnCmdId, dir: timeDir === 1 ? 1 : -1 };
            }

            lastTsForJumpCheck = selectedTs;
        }
    }

    // recompute derived
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

        const sizeByPad = Math.floor(available / 1.10);
        wheelSize = Math.max(320, sizeByPad - 2);
    }

    onMount(() => {
        queueMicrotask(recomputeWheelSize);

        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(recomputeWheelSize);
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
        // user action overrides everything
        cancelLocalAnimationsAndUi();

        selectedSpokeIndex = i;
        activeSpokeIndex = i;

        // This is a “local” change, but it can still be far in time if you click year wheel etc.
        // preTurn will be triggered by the reactive jump checker above (absDelta > cycleMs).
        emitSelectTs(spokeTimes[i]);
    }

    function shiftCycle(dir: -1 | 1) {
        if (isCycling) return;
        isCycling = true;

        // while we are doing button-driven spin, we do NOT want preTurn interfering
        preTurnCmd = null;

        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        const shiftedBase = shiftCycleBase(anchors.E, dir);
        const a2 = computeAnchors(shiftedBase);
        const t2 = buildSpokeTimes(a2);

        const targetTs = t2[i];
        const targetAngleDeg = computeAngle(targetTs, a2);

        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };
        emitSelectTs(targetTs);

        clearTimers();
        unlockTimer = setTimeout(() => {
            isCycling = false;
            unlockTimer = null;
        }, ANIM_MS + 30);
    }

    function onSelectNextE() {
        if (isCycling) return;
        isCycling = true;

        // prevent preTurn
        preTurnCmd = null;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        clearTimers();

        // animate to end-of-cycle
        emitSelectTs(anchors.end - 1);

        nextETimer = setTimeout(() => {
            emitSelectTs(anchors.end);
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
            <div class="sub">{formatDateTime(selectedTs)} · {(progress * 100).toFixed(1)}%</div>
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
                preTurnCmd={preTurnCmd}
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
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
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
        gap: 4px;
    }
    .info strong { font-weight: 650; }
</style>
