<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Wheel from './Wheel.svelte';
    import { buildSpokeTimes, nearestSpokeByTime, progressLinear } from '../lib/cycles/spokes';
    import type { Anchors } from '../lib/cycles/spokes';
    import { getDayAnchors, angleFromDayAnchors, shiftDayCycle } from '../lib/cycles/day';
    import { formatDateTime } from '../lib/format';
    import type { CycleKind, SpinCmd } from '../lib/cycles/types';

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

    let unlockTimer: ReturnType<typeof setTimeout> | null = null;
    let nextETimer: ReturnType<typeof setTimeout> | null = null;

    let anchors: Anchors;
    let spokeTimes: number[];
    let pointerAngleDeg = 0;
    let progress = 0;

    let prevTs = selectedTs;
    let timeDir: -1 | 0 | 1 = 0;

    function clearTimers() {
        if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
        if (nextETimer) { clearTimeout(nextETimer); nextETimer = null; }
    }

    function computeAnchors(): Anchors {
        // пока только day
        return getDayAnchors(selectedTs, lat, lon);
    }

    function computeAngle() {
        // пока только day
        return angleFromDayAnchors(selectedTs, anchors);
    }

    $: console.log(title, 'selectedTs', selectedTs, 'pointerAngleDeg', pointerAngleDeg);

    $: {
        if (selectedTs === prevTs) {
            timeDir = 0;
        } else {
            timeDir = selectedTs > prevTs ? 1 : -1;
            prevTs = selectedTs;
        }
    }

    $: if (resetUiId !== lastResetUiId) {
        lastResetUiId = resetUiId;

        clearTimers();

        selectedSpokeIndex = null;
        activeSpokeIndex = null;
        spinCmd = null;
        isCycling = false;
    }

    $: anchors = getDayAnchors(selectedTs, lat, lon);
    $: spokeTimes = buildSpokeTimes(anchors);
    $: pointerAngleDeg = angleFromDayAnchors(selectedTs, anchors);
    $: progress = progressLinear(selectedTs, anchors.start, anchors.end);

    function recomputeWheelSize() {
        if (!wrapEl) return;

        const style = getComputedStyle(wrapEl);

        const pl = parseFloat(style.paddingLeft) || 0;
        const pr = parseFloat(style.paddingRight) || 0;
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;

        // реальная внутренняя область контейнера
        const innerW = Math.max(0, wrapEl.clientWidth - pl - pr);
        const innerH = Math.max(0, wrapEl.clientHeight - pt - pb);

        // берём минимальную сторону — круг должен влезать целиком
        const available = Math.floor(Math.min(innerW, innerH));

        // Wheel использует pad() = size * 0.05 с каждой стороны → ~10% сверху
        // значит реальный SVG ≈ size * 1.10
        const sizeByPad = Math.floor(available / 1.10);

        // минимальный разумный размер, но БЕЗ верхнего потолка
        wheelSize = Math.max(320, sizeByPad - 2);
    }

    onMount(() => {
        // first render size
        queueMicrotask(() => {
            recomputeWheelSize();
        });

        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(() => {
                recomputeWheelSize();
            });
            ro.observe(wrapEl);
        } else {
            // fallback
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
        // пользователь кликнул — значит его действие важнее любой анимации
        isCycling = false;
        spinCmd = null;

        selectedSpokeIndex = i;
        activeSpokeIndex = i;
        onSelectTs(spokeTimes[i]);
    }

    function shiftCycle(dir: -1 | 1) {
        clearTimers();
        if (isCycling) return;
        isCycling = true;

        // 1) какую спицу хотим сохранить
        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        // 2) считаем целевой цикл и целевую спицу В НЁМ
        const shiftedBase = shiftDayCycle(anchors.E, dir); // важно: от начала цикла
        const a2 = getDayAnchors(shiftedBase, lat, lon);
        const t2 = buildSpokeTimes(a2);

        const targetTs = t2[i];
        const targetAngleDeg = angleFromDayAnchors(targetTs, a2);

        // 3) даём команду Wheel: ровно 1 оборот + приземлиться на нужный угол
        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };

        // 4) меняем глобальное время
        onSelectTs(targetTs);
        console.log(title, 'set ts', targetTs);

        setTimeout(() => {
            isCycling = false;
        }, 420 + 30);
    }

    function onSelectNextE() {
        clearTimers();
        if (isCycling) return;
        isCycling = true;

        selectedSpokeIndex = null;
        activeSpokeIndex = null;

        // animate to end-of-cycle
        onSelectTs(anchors.end - 1);
        console.log(title, 'set ts', anchors.end - 1);

        // snap to next cycle start
        setTimeout(() => {
            onSelectTs(anchors.end);
            console.log(title, 'set ts', anchors.end);
            selectedSpokeIndex = 0;
            activeSpokeIndex = 0;
            isCycling = false;
        }, 420);
    }
</script>

<section class="panel">
    <header class="top">
        <div class="left">
            <div class="title">{title}</div>
            <div class="sub">{(progress * 100).toFixed(1)}%</div>
        </div>

        <div class="right">
            <button on:click={() => shiftCycle(-1)} disabled={isCycling}>←</button>
            <button on:click={() => shiftCycle(1)} disabled={isCycling}>→</button>
        </div>
    </header>

    <!-- IMPORTANT: this wrapper defines the available box for the wheel -->
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
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
        color: inherit;
        cursor: pointer;
    }
    button:disabled { opacity: 0.45; cursor: default; }

    /* This box is what we measure */
    .wrap {
        display: grid;
        place-items: center;
        padding: 12px;
        /* give it a predictable height so ResizeObserver has both axes */
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