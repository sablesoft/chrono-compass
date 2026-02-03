<!-- src/components/Wheel.svelte -->
<script lang="ts">
    import {onDestroy, onMount} from 'svelte';
    import {get} from 'svelte/store';

    import type {CycleKind, PreTurnCmd, SpinCmd} from '../lib/cycles/types';
    import {formatDateTime, ms} from '../lib/format';

    import {isLive, setSelectedTs, startLive} from '../lib/stores/time';
    import {momentsState} from '../lib/stores/moment';

    import {buildSpokeTimes, nearestSpokeByTime} from '../lib/cycles/spokes';
    import {
        buildHouseBoundaries,
        buildMarkerItemsForWheel,
        clusterMarkerItems,
        computeAnchors,
        computeAngle, createMomentClickHandler,
        type MarkerCluster, nudgeInsideCycle,
        SHIFT_EPS_MS,
        SPOKES
    } from '../lib/cycles/wheel';

    import Tooltip from './Tooltip.svelte';
    import {CYCLE_META, SPOKE_DESC} from "../lib/cycles/meta";
    import type { MomentTip } from '../lib/cycles/wheel';
    import { buildSpokeTip, buildBoundaryTip } from '../lib/cycles/wheel';

    export let kind: CycleKind = 'day';

    export let lat: number;
    export let lon: number;

    export let selectedTs: number;
    export let onUserActivity: () => void = () => {};

    /* =======================
       Responsive (inside Wheel)
       ======================= */
    let wrapEl: HTMLDivElement | null = null;
    let ro: ResizeObserver | null = null;
    let size = 360;

    let isCoarsePointer = false;
    let mqCoarse: MediaQueryList | null = null;

    let currentSpokeTip: MomentTip | null = null;

    $: {
        if (!spokeTimes?.length) {
            currentSpokeTip = null;
        } else {
            const i = nearestSpokeByTime(selectedTs, spokeTimes);
            const label = labels[i];
            const ts0 = spokeTimes[i];
            currentSpokeTip = ts0 ? buildSpokeTip(kind, label, ts0) : null;
        }
    }

    function updatePointerMode() {
        isCoarsePointer = !!mqCoarse?.matches;
    }

    function handleMarkerClick(e: MouseEvent, c: MarkerCluster) {
        if (isCoarsePointer) {
            // toggle same cluster
            if (tipOpen && tipCluster?.id === c.id) {
                closeTipNow();
            } else {
                openClusterTip(e, c);
            }
            return;
        }

        // desktop: click selects
        handleMarkerActivate(c);
    }

    function handleGlobalPointerDown(e: PointerEvent | MouseEvent) {
        if (!tipOpen) return;
        const el = e.target as Element | null;
        if (!el) return;

        // если тап по тултипу или по маркеру — не закрываем
        if (el.closest('[data-tooltip-root]') || el.closest('[data-marker]')) return;

        closeTipNow();
    }

    function recomputeWheelSize() {
        if (!wrapEl) return;

        // Размер считаем по внутренней области wrap
        const style = getComputedStyle(wrapEl);
        const pl = parseFloat(style.paddingLeft) || 0;
        const pr = parseFloat(style.paddingRight) || 0;
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;

        const innerW = Math.max(0, wrapEl.clientWidth - pl - pr);
        const innerH = Math.max(0, wrapEl.clientHeight - pt - pb);
        const available = Math.floor(Math.min(innerW, innerH));

        // оставляем немного воздуха
        const sizeByPad = Math.floor(available / 1.10);
        size = Math.max(320, sizeByPad - 2);
    }

    /* =======================
       Wheel geometry
       ======================= */
    const labels = [
        'E','ENE','NE','NNE',
        'N','NNW','NW','WNW',
        'W','WSW','SW','SSW',
        'S','SSE','SE','ESE'
    ] as const;

    const spokeCount = 16;
    const stepDeg = 360 / spokeCount;
    const POINTER_ANIM_MS = 420;

    const VB = 1000;
    const cx = VB / 2;
    const cy = VB / 2;

    const rOuter = VB * 0.42;
    const rInner = VB * 0.18;
    const rLabel = VB * 0.48;

    function boundaryAngleDeg(i: number) {
        return -(i + 0.5) * stepDeg;
    }

    function spokeAngleDeg(i: number) {
        return -stepDeg * i;
    }

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function ringSectorPath(a0: number, a1: number) {
        const o0 = polarToXY(rOuter, a0);
        const o1 = polarToXY(rOuter, a1);
        const i1 = polarToXY(rInner, a1);
        const i0 = polarToXY(rInner, a0);

        const largeArc = 0;
        const sweepOuter = a1 >= a0 ? 1 : 0;
        const sweepInner = sweepOuter ? 0 : 1;

        return [
            `M ${o0.x} ${o0.y}`,
            `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweepOuter} ${o1.x} ${o1.y}`,
            `L ${i1.x} ${i1.y}`,
            `A ${rInner} ${rInner} 0 ${largeArc} ${sweepInner} ${i0.x} ${i0.y}`,
            'Z'
        ].join(' ');
    }

    function isFiniteNumber(x: unknown): x is number {
        return typeof x === 'number' && Number.isFinite(x);
    }

    function safeAngle(x: unknown, fallback: number) {
        return isFiniteNumber(x) ? x : fallback;
    }

    function safeDir(x: unknown): -1 | 0 | 1 {
        return x === 1 || x === -1 || x === 0 ? x : 0;
    }

    /* =======================
       Derived model (anchors/spokes/boundaries/markers)
       ======================= */
    let anchors = computeAnchors(kind, selectedTs, lat, lon);
    $: anchors = computeAnchors(kind, selectedTs, lat, lon);

    let spokeTimes: number[] = [];
    $: spokeTimes = buildSpokeTimes(anchors);

    let pointerAngleDeg = 0;
    $: pointerAngleDeg = computeAngle(kind, selectedTs, anchors);

    // boundaryTimes: midpoints-in-cycle
    let boundaryTimes: number[] = [];

    function wrapIntoCycle(ts0: number, cycleStart: number, cycleMs: number) {
        let x = ts0;
        while (x < cycleStart) x += cycleMs;
        while (x >= cycleStart + cycleMs) x -= cycleMs;
        return ms(x);
    }

    function midpointInCycle(a: number, b: number, cycleStart: number, cycleMs: number) {
        let b2 = b;
        if (b2 < a) b2 += cycleMs;
        const mid = a + (b2 - a) / 2;
        return wrapIntoCycle(mid, cycleStart, cycleMs);
    }

    $: {
        const cycleMs = Math.max(1, anchors.end - anchors.start);
        boundaryTimes = Array.from({ length: SPOKES }, (_, i) => {
            const a = spokeTimes[i];
            const b = spokeTimes[(i + 1) % SPOKES];
            return midpointInCycle(a, b, anchors.start, cycleMs);
        });
    }

    let houseBoundaries: number[] = [];
    $: houseBoundaries = buildHouseBoundaries(spokeTimes);

    // markers => clusters
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
       Local UI state (from old CycleWheel)
       ======================= */
    let selectedSpokeIndex: number | null = null;
    let activeSpokeIndex: number | null = null;

    let spinCmd: SpinCmd | null = null;
    let spinCmdId = 0;

    let preTurnCmd: PreTurnCmd | null = null;
    let preTurnCmdId = 0;

    let isCycling = false;

    // self-change marker to avoid external-preTurn on our own setSelectedTs
    let pendingSelfTs: number | null = null;
    let lastSeenTs = selectedTs;

    // time direction (future => CCW, past => CW)
    let timeDir: -1 | 0 | 1 = 0;

    const ANIM_MS = 420;

    let unlockTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
        if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
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
        setSelectedTs(t);
    }

    // shiftCycle now lives here
    function shiftCycle(dir: -1 | 1) {
        onUserActivity();
        if (isCycling) return;
        isCycling = true;

        preTurnCmd = null;

        const i = activeSpokeIndex ?? nearestSpokeByTime(selectedTs, spokeTimes);
        activeSpokeIndex = i;
        selectedSpokeIndex = i;

        let shiftedBase = dir > 0
            ? anchors.E_next + SHIFT_EPS_MS
            : anchors.E - SHIFT_EPS_MS;

        let a2 = computeAnchors(kind, shiftedBase, lat, lon);
        if (!(shiftedBase >= a2.E && shiftedBase < a2.E_next)) {
            shiftedBase = dir > 0 ? a2.E + SHIFT_EPS_MS : a2.E_next - SHIFT_EPS_MS;
            a2 = computeAnchors(kind, shiftedBase, lat, lon);
        }

        const t2 = buildSpokeTimes(a2);

        let targetTs = ms(t2[i]);
        targetTs = nudgeInsideCycle(targetTs, a2, dir);

        const targetAngleDeg = computeAngle(kind, targetTs, a2);

        spinCmd = { id: ++spinCmdId, dir, targetAngleDeg };
        emitSelectTs(targetTs);

        clearTimers();
        unlockTimer = setTimeout(() => {
            isCycling = false;
            unlockTimer = null;
        }, ANIM_MS + 30);
    }

    // detect selectedTs changes, compute timeDir, inject preTurn only for external big jumps
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

            if (!isCycling && !isSelf) {
                // кто-то извне дернул selectedTs -> приводим UI/команды в порядок
                cancelLocalAnimationsAndUi();

                const aNow = computeAnchors(kind, selectedTs, lat, lon);
                const cycleMs = Math.max(1, aNow.end - aNow.start);

                preTurnCmd = absDelta > cycleMs
                    ? { id: ++preTurnCmdId, dir: timeDir > 0 ? 1 : -1 }
                    : null;
            }
        }
    }

    /* =======================
       NOW pointer (no store; local minute ticker)
       ======================= */
    let nowTs = ms(Date.now());
    let nowTimer: ReturnType<typeof setInterval> | null = null;
    let nowAlignTimer: ReturnType<typeof setTimeout> | null = null;

    function clearNowTimers() {
        if (nowAlignTimer) { clearTimeout(nowAlignTimer); nowAlignTimer = null; }
        if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
    }

    function startNowTicker() {
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

    let showNowPointer = false;
    let nowPointerAngleDeg: number | null = null;

    $: {
        const live = get(isLive);
        if (live) {
            showNowPointer = false;
            nowPointerAngleDeg = null;
        } else {
            const inside = nowTs >= anchors.start && nowTs <= anchors.end;
            showNowPointer = inside;
            nowPointerAngleDeg = inside ? computeAngle(kind, nowTs, anchors) : null;
        }
    }

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

    function anchorTs(k: AnchorKey) {
        return anchors[k];
    }

    function spokeDesc(k: AnchorKey) {
        return SPOKE_DESC[kind][k];
    }

    function houseStartTs(i: number) {
        if (i === 0) {
            // start of E house is midpoint between prev-cycle ESE and current E
            const prevBase = anchors.E - SHIFT_EPS_MS;
            const aPrev = computeAnchors(kind, prevBase, lat, lon);
            const spokesPrev = buildSpokeTimes(aPrev);

            const prevESE = spokesPrev[15];
            const curE = spokeTimes[0];
            return ms((prevESE + curE) / 2);
        }
        return boundaryTimes[(i - 1 + SPOKES) % SPOKES];
    }

    function houseEndTs(i: number) {
        return boundaryTimes[i];
    }

    function jumpTo(ts0: number) {
        onUserActivity();
        // важно: сбрасываем циклинг/команды, чтобы не залипнуть в “режиме перелистывания”
        cancelLocalAnimationsAndUi();
        emitSelectTs(ts0);
    }

    /* =======================
       Tooltip wiring
       ======================= */
    let tipOpen = false;
    let tipX = 0;
    let tipY = 0;
    let tipMoment: MomentTip | null = null;
    let tipCluster: MarkerCluster | null = null;

    let tipHideTimer: ReturnType<typeof setTimeout> | null = null;

    function openMomentTip(e: MouseEvent, tip: MomentTip) {
        if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
        tipOpen = true;
        tipMoment = tip;
        tipCluster = null;
        tipX = e.clientX;
        tipY = e.clientY;
        // console.log('openMomentTip', {tipOpen, tipMoment, tipCluster, tipX, tipY});
    }

    function openClusterTip(e: MouseEvent, c: MarkerCluster) {
        if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
        tipOpen = true;
        tipCluster = c;
        tipMoment = null;
        tipX = e.clientX;
        tipY = e.clientY;
        // console.log('openClusterTip', {tipOpen, tipMoment, tipCluster, tipX, tipY});
    }

    function moveTip(e: MouseEvent) {
        if (!tipOpen) return;
        tipX = e.clientX;
        tipY = e.clientY;
    }

    function scheduleCloseTip() {
        if (tipHideTimer) clearTimeout(tipHideTimer);
        tipHideTimer = setTimeout(() => {
            tipOpen = false;
            tipCluster = null;
            tipHideTimer = null;
        }, 120);
    }

    function keepTipOpen() {
        if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    }

    function closeTipNow() {
        if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
        tipOpen = false;
        tipCluster = null;
    }

    /* =======================
       Pointer animation logic (your original)
       ======================= */
    let displayAngle = pointerAngleDeg;
    let lastAngle = pointerAngleDeg;

    let lastSpinCmdId = 0;
    let lastPreTurnCmdId = 0;

    let spinLock = false;
    let spinLockTarget = 0;
    let spinLockTimer: ReturnType<typeof setTimeout> | null = null;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function clearSnapMode() {
        // это именно “анти-залипание” после NextE (и любых будущих snap-фич)
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
        noTransition = false;
    }

    function normalizeNearest(baseAngle: number, current: number) {
        let t = baseAngle;
        while (t - current > 180) t -= 360;
        while (t - current < -180) t += 360;
        return t;
    }

    let nowDisplayAngle = 0;
    let lastNowAngle = 0;

    $: {
        if (!showNowPointer || nowPointerAngleDeg === null) {
            // noop
        } else {
            const target = safeAngle(nowPointerAngleDeg, lastNowAngle);
            const t = normalizeNearest(target, lastNowAngle);
            nowDisplayAngle = t;
            lastNowAngle = t;
        }
    }

    function normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = normalizeNearest(baseAngle, current);
        if (dir === 0) return t;

        //  1 => forward => CCW => negative delta
        // -1 => back    => CW  => positive delta
        const wantSign = dir > 0 ? -1 : 1;
        let delta = t - current;

        if (Math.abs(delta) > 1e-9 && Math.sign(delta) !== wantSign) {
            t += 360 * wantSign;
            delta = t - current;
        }
        return t;
    }

    function computeFullTurnTarget(targetAngleDeg0: number, current: number, dir: 1 | -1) {
        const turn = -360 * dir;
        const wantSign = Math.sign(turn);

        let t = normalizeNearest(targetAngleDeg0, current);

        const d0 = t - current;
        if (Math.abs(d0) > 1e-9 && Math.sign(d0) !== wantSign) {
            t += 360 * wantSign;
        }

        return t + turn;
    }

    function computePreTurnTarget(currentTargetAngle: number, current: number, dir: 1 | -1) {
        const turn = -360 * dir;
        const base = normalizeNearest(currentTargetAngle, current);
        return base + turn;
    }

    function startSpinLock(target: number) {
        spinLock = true;
        spinLockTarget = target;

        if (spinLockTimer) clearTimeout(spinLockTimer);
        spinLockTimer = setTimeout(() => {
            spinLock = false;
        }, POINTER_ANIM_MS + 20);
    }

    function mod(n: number, m: number) {
        return ((n % m) + m) % m;
    }

    function nearestSpokeIndexFromAngle(angleDeg: number) {
        const raw = (-angleDeg) / stepDeg;
        const i = Math.round(raw);
        return mod(i, spokeCount);
    }

    let nearestSpokeIndex = 0;
    $: nearestSpokeIndex = nearestSpokeIndexFromAngle(safeAngle(displayAngle, 0));

    $: {
        lastAngle = safeAngle(lastAngle, 0);

        const ptr = safeAngle(pointerAngleDeg, lastAngle);
        const dir0 = safeDir(timeDir);

        if (spinLock) {
            const t = safeAngle(spinLockTarget, lastAngle);
            displayAngle = t;
            lastAngle = t;
        } else if (spinCmd && spinCmd.id !== lastSpinCmdId) {
            lastSpinCmdId = spinCmd.id;

            const cmdDir: 1 | -1 = spinCmd.dir;
            const targetBase = safeAngle(spinCmd.targetAngleDeg, lastAngle);
            const target = computeFullTurnTarget(targetBase, lastAngle, cmdDir);

            startSpinLock(target);
            displayAngle = target;
            lastAngle = target;
        } else if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
            lastPreTurnCmdId = preTurnCmd.id;

            const cmdDir: 1 | -1 = preTurnCmd.dir;

            if (cmdDir === 1 || cmdDir === -1) {
                const target = computePreTurnTarget(ptr, lastAngle, cmdDir);
                startSpinLock(target);
                displayAngle = target;
                lastAngle = target;
            } else {
                const t = normalizeNearest(ptr, lastAngle);
                displayAngle = t;
                lastAngle = t;
            }
        } else {
            const t = normalizeByDirection(ptr, lastAngle, dir0);
            displayAngle = t;
            lastAngle = t;
        }
    }

    /* =======================
       Click handlers
       ======================= */
    function handleSpokeActivate(i: number) {
        clearSnapMode();
        const t = spokeTimes[i];
        if (t) jumpTo(t);
    }

    function handleBoundaryActivate(i: number) {
        clearSnapMode();
        const t = boundaryTimes[i];
        if (t) jumpTo(t);
    }

    function handleMarkerActivate(c: MarkerCluster) {
        clearSnapMode();
        jumpTo(c.ts);
        closeTipNow();
    }

    function handleMarkerPick(ts0: number) {
        clearSnapMode();
        jumpTo(ts0);
        closeTipNow();
    }

    function handleNextE() {
        clearSnapMode();

        // “E+” — anchors.E_next. Чтобы избежать boundary-no-op, делаем шаг внутрь цикла.
        const endTs = anchors.E_next;
        jumpTo(endTs - SHIFT_EPS_MS);

        // затем короткий режим “snap” без transition, чтобы не было рывка на новом цикле
        resetTimer = setTimeout(() => {
            noTransition = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    noTransition = false;
                });
            });
        }, POINTER_ANIM_MS);
    }

    /* =======================
       Lifecycle
       ======================= */
    onMount(() => {
        startNowTicker();
        queueMicrotask(recomputeWheelSize);
        window.addEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
        if (wrapEl && 'ResizeObserver' in window) {
            ro = new ResizeObserver(recomputeWheelSize);
            ro.observe(wrapEl);
        }
        if (typeof window !== 'undefined' && 'matchMedia' in window) {
            mqCoarse = window.matchMedia('(pointer: coarse)');
            updatePointerMode();

            const onChange = () => updatePointerMode();
            // Safari старый: addListener/removeListener
            if ('addEventListener' in mqCoarse) mqCoarse.addEventListener('change', onChange);
            else (mqCoarse as any).addListener(onChange);

            return () => {
                if (!mqCoarse) return;
                if ('removeEventListener' in mqCoarse) mqCoarse.removeEventListener('change', onChange);
                else (mqCoarse as any).removeListener(onChange);
            };
        }
    });

    onDestroy(() => {
        clearTimers();
        clearNowTimers();
        window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true } as any);
        if (ro && wrapEl) ro.unobserve(wrapEl);
        ro?.disconnect();

        if (resetTimer) clearTimeout(resetTimer);
        if (spinLockTimer) clearTimeout(spinLockTimer);
        if (tipHideTimer) clearTimeout(tipHideTimer);
    });
</script>

<section class="panel">
    <header class="top">
        <div class="left">
            <div class="title">{CYCLE_META[kind].label} - {CYCLE_META[kind].description}</div>
        </div>

        <div class="right">
            <button type="button"
                    class="navBtn"
                    title={`Previous ${CYCLE_META[kind].label}`}
                    on:click={() => shiftCycle(-1)}
                    disabled={isCycling}>←</button>

            <button type="button"
                    class="navBtn"
                    title={`Next ${CYCLE_META[kind].label}`}
                    on:click={() => shiftCycle(1)}
                    disabled={isCycling}>→</button>
        </div>
    </header>

    <div class="wrap" bind:this={wrapEl}>
        <section class="wheelPanel">

            <!-- Wheel SVG -->
            <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Wheel">
                <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
                <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

                <!-- clickable house-boundary ticks -->
                {#each Array(spokeCount) as _, i (i)}
                    {@const a = boundaryAngleDeg(i)}
                    {@const pA = polarToXY(rOuter * 0.93, a)}
                    {@const pB = polarToXY(rOuter * 1.02, a)}
                    {@const pHit = polarToXY(rOuter * 1.02, a)}
                    {@const boundaryClick = createMomentClickHandler({
                        onSingle: (e) =>
                            openMomentTip(e, buildBoundaryTip(labels[i], labels[(i+1)%spokeCount], boundaryTimes[i])),
                        onDouble: () => jumpTo(boundaryTimes[i]),
                    })}
                    <g class="tick"
                       role="button"
                       tabindex="0"
                       aria-label={`House boundary ${i + 1}`}
                       on:click={boundaryClick.onClick}
                       on:dblclick={boundaryClick.onDblClick}
                       on:mouseenter={(e) => { /* desktop hover */ openMomentTip(e, buildBoundaryTip(labels[i], labels[(i+1)%spokeCount], boundaryTimes[i]))}}
                       on:mouseleave={scheduleCloseTip}
                       on:keydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleBoundaryActivate(i);
                          }
                       }}>
                        <line x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y} class="tickLine"/>
                        <circle cx={pHit.x} cy={pHit.y} r={VB * 0.03} fill="transparent"/>
                    </g>
                {/each}

                <!-- quadrant tint ring -->
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
                    {@const spokeClick = createMomentClickHandler({
                        onSingle: (e) =>
                            openMomentTip(e, buildSpokeTip(kind, label, spokeTimes[i])),
                        onDouble: () => handleSpokeActivate(i),
                    })}

                    <g class="spoke"
                       role="button"
                       tabindex="0"
                       aria-label={`Spoke ${label}`}
                       on:click={spokeClick.onClick}
                       on:dblclick={spokeClick.onDblClick}
                       on:mouseenter={(e) => { /* desktop hover */ openMomentTip(e, buildSpokeTip(kind, label, spokeTimes[i])) }}
                       on:mouseleave={scheduleCloseTip}
                       on:keydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSpokeActivate(i);
                          }
                       }}>
                        <line x1={p1.x} y1={p1.y}
                              x2={p2.x} y2={p2.y}
                              stroke="currentColor"
                              stroke-opacity={selectedSpokeIndex === i ? 0.9 : 0.35}
                              stroke-width={i % 4 === 0 ? 7 : 4}
                              stroke-linecap="round"/>

                        {#if i === nearestSpokeIndex}
                            <circle cx={pt.x}
                                    cy={pt.y}
                                    r={VB * 0.054}
                                    fill="transparent"
                                    stroke="currentColor"
                                    stroke-opacity="0.55"
                                    stroke-width="3"/>
                        {/if}

                        <text class="spokeLabel"
                              x={pt.x} y={pt.y}
                              text-anchor="middle"
                              dominant-baseline="middle"
                              font-size={VB * 0.042}
                              fill="currentColor"
                              fill-opacity={selectedSpokeIndex === i ? 1 : 0.65}>
                            {label}
                        </text>

                        {#if i === 0}
                            {@const pt2 = { x: pt.x + 5, y: pt.y + VB * 0.06 }}
                            <g class="eplus">
                                <circle class="eplusHit"
                                        cx={pt2.x}
                                        cy={pt2.y}
                                        r={VB * 0.04}
                                        fill="transparent"
                                        on:click|stopPropagation={handleNextE}
                                        role="button"
                                        tabindex="0"
                                        aria-label="Next cycle (E+)"
                                        on:keydown|stopPropagation={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleNextE();
                                            }
                                        }}/>
                                <title>{spokeTimes[16] ? formatDateTime(spokeTimes[16]) : ''}</title>
                                <text class="spokeLabel eplusLabel"
                                      x={pt2.x} y={pt2.y}
                                      text-anchor="middle"
                                      dominant-baseline="middle"
                                      font-size={VB * 0.034}
                                      fill="currentColor"
                                      fill-opacity={0.55}>
                                    E+
                                </text>
                            </g>
                        {/if}

                        <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
                    </g>
                {/each}

                {#if showNowPointer && nowPointerAngleDeg !== null}
                    <g class="nowPointer" transform={`rotate(${safeAngle(nowDisplayAngle, 0)} ${cx} ${cy})`}>
                        <line x1={cx} y1={cy}
                              x2={cx + rOuter} y2={cy}
                              stroke="var(--accent-live)"
                              stroke-width="10"
                              stroke-linecap="round"
                              stroke-opacity="0.35"/>
                        <circle cx={cx + rOuter}
                                cy={cy}
                                r={VB * 0.018}
                                fill="var(--accent-live)"
                                fill-opacity="0.65"
                                role="button"
                                tabindex="0"
                                aria-label="Go LIVE (now)"
                                on:click|stopPropagation={startLive}
                                on:keydown|stopPropagation={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      startLive();
                                    }
                                }}/>
                    </g>
                {/if}

                <!-- Moment Markers (clustered) -->
                {#each markerClusters as c (c.id)}
                    {@const a = c.angleDeg}
                    {@const rMark = orbitToRadiusVB(c.orbit)}
                    {@const p = polarToXY(rMark, a)}
                    <g class="marker"
                       data-marker="1"
                       transform={`translate(${p.x} ${p.y})`}
                       on:click={(e) => handleMarkerClick(e, c)}
                       on:mouseenter={(e) => { if (!isCoarsePointer) openClusterTip(e, c); }}
                       on:mousemove={(e) => { if (!isCoarsePointer) moveTip(e); }}
                       on:mouseleave={() => { if (!isCoarsePointer) scheduleCloseTip(); }}>
                        <circle r={VB * 0.035} fill="transparent" />

                        <circle r={VB * 0.02}
                                fill={c.bg}
                                stroke="currentColor"
                                stroke-opacity="0.45"
                                stroke-width="3"/>
                        <circle r={VB * 0.018}
                                fill="none"
                                stroke="var(--bg)"
                                stroke-opacity="0.5"
                                stroke-width="2"/>

                        <text text-anchor="middle"
                              dominant-baseline="middle"
                              font-size={VB * 0.02}
                              fill="currentColor"
                              fill-opacity="0.95"
                              style="pointer-events:none">
                            {c.count === 1 ? c.emoji : c.label}
                        </text>
                    </g>
                {/each}

                <!--Current Moment Pointer -->
                <g transform={`translate(${cx} ${cy})`}>
                    <g class="pointer" class:noTransition={noTransition} style={`transform: rotate(${safeAngle(displayAngle, 0)}deg);`}>
                        <line x1="0" y1="0"
                              x2={rOuter} y2="0"
                              stroke="currentColor"
                              stroke-width="9"
                              stroke-linecap="round"/>
                        <circle cx={rOuter} cy="0" r={VB * 0.02} fill="currentColor" />
                    </g>
                </g>
                <circle cx={cx} cy={cy} r={VB * 0.012} fill="currentColor" />
            </svg>

            {#if currentSpokeTip}
                <div class="currentSpoke">
                    <strong>{currentSpokeTip.label}</strong>
                </div>
            {/if}

            <!-- Tooltip -->
            {#if tipOpen && (tipCluster || tipMoment)}
                <Tooltip x={tipX}
                        y={tipY}
                        cluster={tipCluster}
                        moment={tipMoment}
                        onPickTs={handleMarkerPick}
                        onMouseEnter={keepTipOpen}
                        onMouseLeave={scheduleCloseTip}
                        onClose={closeTipNow}/>
            {/if}
        </section>
    </div>

    <!-- Wheel Info -->
    <div class="info">
        {#each infoItems as row (row.key)}
            <div class="infoRow">
                <button class="jump"
                        type="button"
                        title={`Go to ${row.key}`}
                        on:click={() => jumpTo(row.ts)}>
                    <strong class="k">{row.key}:</strong>
                    <span class="dt">{formatDateTime(row.ts)}</span>
                    <span class={row.key === 'S' ? 'sep' : ''}>—</span>
                    <span class="desc">{spokeDesc(row.anchor)}</span>
                </button>

                {#if row.showHouse}
                          <span class="houseBtns">
                            <button type="button"
                                    class="hb"
                                    title={`House start: ${formatDateTime(houseStartTs(row.houseIndex))}`}
                                    on:click={() => jumpTo(houseStartTs(row.houseIndex))}>start</button>
                            <button type="button"
                                    class="hb"
                                    title={`House end: ${formatDateTime(houseEndTs(row.houseIndex))}`}
                                    on:click={() => jumpTo(houseEndTs(row.houseIndex))}>end</button>
                          </span>
                {/if}
            </div>
        {/each}
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
        display: grid;
        place-items: center;
        padding: 12px;
        aspect-ratio: 1 / 1;
        width: 100%;
        max-width: 100%;
        overflow: hidden; /* режем только SVG, не info */
    }

    .wheelPanel{
        display: grid;
        gap: 10px;
        place-items: center;
        width: 100%;
    }

    svg {
        display: block;       /* чтобы не было странных inline-gap */
        max-width: 100%;
        max-height: 100%;
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

    /* info block */
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
</style>
