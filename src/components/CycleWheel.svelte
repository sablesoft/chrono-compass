<!-- src/components/CycleWheel.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Wheel from './Wheel.svelte';
    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';

    import { getDayAnchors, angleFromDayAnchors } from '../lib/cycles/day';
    import { getMoonAnchors, angleFromMoonAnchors } from '../lib/cycles/moon';
    import { getYearAnchors, angleFromYearAnchors } from '../lib/cycles/year';
    import { getPlatoAnchors, angleFromPlatoAnchors } from '../lib/cycles/plato';

    import { formatDateTime } from '../lib/format';
    import type { CycleKind, SpinCmd, PreTurnCmd } from '../lib/cycles/types';

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
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;
    let nextETimer: ReturnType<typeof setTimeout> | null = null;

    // --- self-change marker (critical!)
    let pendingSelfTs: number | null = null;
    let lastSeenTs = selectedTs;

    function clearTimers() {
        if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
        if (nextETimer) { clearTimeout(nextETimer); nextETimer = null; }
    }

    function logCycle(tag: string, extra: Record<string, any> = {}) {
        const now = Date.now();
        console.log(`[${title}/${kind}] ${tag}`, {
            selectedTs,
            nextCurrentTm: now,
            E: anchors?.E,
            E_next: anchors?.E_next,
            ...extra
        });
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
        // mark it as ours BEFORE changing global state
        pendingSelfTs = ts;
        onSelectTs(ts);
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

    function nextCycleStart(a: Anchors) {
        return a.E_next; // start of next cycle
    }

    function prevCycleStart(a: Anchors) {
        // “секунда до старта текущего” -> anchors предыдущего цикла
        const aPrev = computeAnchors(a.E - 1);
        return aPrev.E; // start of previous cycle
    }

    // resetUiId => явный сброс
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

            // While this wheel runs its own button animation, do not inject anything.
            if (isCycling) {
                // keep commands as-is
            } else {
                if (!isSelf) {
                    // external change (other wheel / Now / picking date later)
                    cancelLocalAnimationsAndUi();

                    // decide if we want a “pre-turn” (jump bigger than one cycle)
                    const aNow = computeAnchors(selectedTs);
                    const cycleMs = Math.max(1, aNow.end - aNow.start);

                    if (absDelta > cycleMs) {
                        preTurnCmd = { id: ++preTurnCmdId, dir: timeDir > 0 ? 1 : -1 };
                    } else {
                        preTurnCmd = null;
                    }
                } else {
                    // self change: do NOT inject preTurn here, and do NOT cancel our spinCmd
                    // (otherwise ←/→ will “double-spin”)
                }
            }
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
        onUserActivity();

        // user action overrides our local animations
        cancelLocalAnimationsAndUi();

        selectedSpokeIndex = i;
        activeSpokeIndex = i;

        // within this wheel it's always inside current cycle, so no need to force preTurn here
        emitSelectTs(spokeTimes[i]);
    }

    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        preTurnCmd = null;

        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        // IMPORTANT: base is real cycle boundary, not Date arithmetic
        const shiftedBase = (dir > 0) ? nextCycleStart(anchors) : prevCycleStart(anchors);

        const a2 = computeAnchors(shiftedBase);
        const t2 = buildSpokeTimes(a2);

        const targetTs = t2[i];
        const targetAngleDeg = computeAngle(targetTs, a2);

        logCycle('shiftCycle', {
            dir,
            fromTs: selectedTs,
            baseE: anchors.E,
            baseE_next: anchors.E_next,
            shiftedBase,
            a2E: a2.E,
            a2E_next: a2.E_next,
            targetTs
        });

        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };
        emitSelectTs(targetTs);

        clearTimers();
        unlockTimer = setTimeout(() => {
            isCycling = false;
            unlockTimer = null;
        }, ANIM_MS + 30);
    }

    function onSelectNextE() {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        clearTimers();

        // target must be captured BEFORE changing selectedTs
        const endTs = anchors.E_next;
        const endMinus1 = endTs - 1;

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
