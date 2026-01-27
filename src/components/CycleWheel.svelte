<script lang="ts">
    import Wheel from './Wheel.svelte';
    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';
    import { getDayAnchors, angleFromDayAnchors, shiftDayCycle } from '../lib/cycles/day';
    import type { CycleKind } from '../lib/cycles/types';
    import { formatDateTime } from '../lib/format';

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

    let spinCmd: { id: number; dir: 1 | -1 } | null = null;
    let spinCmdId = 0;

    let isCycling = false;

    let wrapEl: HTMLElement | null = null;
    let wheelSize = 480;

    function computeWheelSize() {
        if (!wrapEl) return;

        // ширина именно контейнера под колесо
        const w = wrapEl.clientWidth;

        // Wheel внутри добавляет pad() = size*0.05 с каждой стороны во viewBox,
        // т.е. фактическая “занимаемая” ширина ~ size*1.10.
        // Поэтому берём size = w / 1.10 и ещё чуть запас.
        const maxByWrap = Math.floor((w - 8) / 1.10);

        wheelSize = Math.max(320, Math.min(640, Math.floor(w - 18*2 - 12*2 - 8)));
    }

    function onResize() {
        computeWheelSize();
    }

    function computeAnchors(): Anchors {
        // пока только day, но kind используем, чтобы IDE не ныла
        switch (kind) {
            case 'day':
            case 'moon':
            case 'year':
            default:
                return getDayAnchors(selectedTs, lat, lon);
        }
    }

    function computeAngle() {
        switch (kind) {
            case 'day':
            case 'moon':
            case 'year':
            default:
                return angleFromDayAnchors(selectedTs, anchors);
        }
    }

    // Compute per wheel
    $: anchors = computeAnchors();
    $: spokeTimes = buildSpokeTimes(anchors);
    $: pointerAngleDeg = computeAngle();
    $: progress = progressLinear(selectedTs, anchors.start, anchors.end);

    // recompute size whenever layout changes
    $: computeWheelSize();

    function onSelectSpoke(i: number) {
        if (isCycling) return;

        selectedSpokeIndex = i;
        activeSpokeIndex = i;
        onSelectTs(spokeTimes[i]);
    }

    function shiftCycle(dir: -1 | 1) {
        if (isCycling) return;
        isCycling = true;

        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        // full-circle animation
        spinCmd = { id: ++spinCmdId, dir };

        // shift cycle (day = +/-1 day)
        const shifted = shiftDayCycle(selectedTs, dir);
        const a2 = getDayAnchors(shifted, lat, lon);
        const t2 = buildSpokeTimes(a2);

        onSelectTs(t2[i]);

        setTimeout(() => {
            isCycling = false;
        }, 420 + 30);
    }

    function onSelectNextE() {
        if (isCycling) return;
        isCycling = true;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        // animate to end-of-cycle
        onSelectTs(anchors.end - 1);

        // snap to next cycle start
        setTimeout(() => {
            onSelectTs(anchors.end);
            selectedSpokeIndex = 0;
            activeSpokeIndex = 0;
            isCycling = false;
        }, 420);
    }
</script>

<svelte:window on:resize={onResize} />

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
        font-size: 20px;
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
        flex: 0 0 auto;
    }

    button {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
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
        /*padding: 12px;*/
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