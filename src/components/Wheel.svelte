<!-- src/components/Wheel.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import type { SpinCmd, PreTurnCmd } from '../lib/cycles/types';
    export let nowPointerAngleDeg: number | null = null;
    export let showNowPointer = false;
    export let onClickNow: () => void = () => {};
    const labels = [
        'E','ENE','NE','NNE',
        'N','NNW','NW','WNW',
        'W','WSW','SW','SSW',
        'S','SSE','SE','ESE'
    ] as const;

    const spokeCount = 16;
    const stepDeg = 360 / spokeCount;
    const POINTER_ANIM_MS = 420;

    export let size = 360;
    export let showLabels = true;

    // “ровно 1 оборот + приземление на targetAngleDeg”
    export let spinCmd: SpinCmd | null = null;

    // “сделай 1 полный оборот, потом приземлись на pointerAngleDeg”
    export let preTurnCmd: PreTurnCmd | null = null;

    export let selectedSpokeIndex: number | null = null;
    export let pointerAngleDeg = 0;

    //  1  => time forward => CCW (negative)
    // -1  => time back    => CW  (positive)
    //  0  => unknown
    export let timeDir: -1 | 0 | 1 = 0;

    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    // Single coordinate space
    const VB = 1000;
    const cx = VB / 2;
    const cy = VB / 2;

    const rOuter = VB * 0.42;
    const rInner = VB * 0.18;
    const rLabel = VB * 0.48;

    function isFiniteNumber(x: unknown): x is number {
        return typeof x === 'number' && Number.isFinite(x);
    }

    function safeAngle(x: unknown, fallback: number) {
        return isFiniteNumber(x) ? x : fallback;
    }

    function safeDir(x: unknown): -1 | 0 | 1 {
        return x === 1 || x === -1 || x === 0 ? x : 0;
    }

    // Continuous animation state
    let displayAngle = pointerAngleDeg;
    let lastAngle = pointerAngleDeg;

    let lastSpinCmdId = 0;
    let lastPreTurnCmdId = 0;

    // Lock while doing a forced spin (pre-turn or spinCmd)
    let spinLock = false;
    let spinLockTarget = 0;
    let spinLockTimer: ReturnType<typeof setTimeout> | null = null;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(r: number, a0: number, a1: number) {
        const p0 = polarToXY(r, a0);
        const p1 = polarToXY(r, a1);
        return `A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`;
    }

    function ringSectorPath(a0: number, a1: number) {
        const o0 = polarToXY(rOuter, a0);
        const o1 = polarToXY(rOuter, a1);
        const i1 = polarToXY(rInner, a1);
        const i0 = polarToXY(rInner, a0);

        // quarter => always small arc
        const largeArc = 0;
        // SVG sweep: 1 = clockwise, 0 = counterclockwise
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

    function spokeAngleDeg(i: number) {
        return -stepDeg * i; // time-forward is CCW => negative
    }

    function clearSnapMode() {
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
        noTransition = false;
    }

    // Nearest equivalent (no direction preference)
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
            // можно ничего не трогать, или при желании сбросить:
            // nowDisplayAngle = lastNowAngle;
        } else {
            const target = safeAngle(nowPointerAngleDeg, lastNowAngle);
            const t = normalizeNearest(target, lastNowAngle);
            nowDisplayAngle = t;
            lastNowAngle = t;
        }
    }

    // Pick an equivalent angle so that:
    // - it stays "near" current
    // - if dir is known, delta sign matches time direction
    function normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = normalizeNearest(baseAngle, current);

        if (dir === 0) return t;

        const wantSign = dir > 0 ? -1 : 1; // future => CCW => negative delta
        let delta = t - current;

        if (Math.abs(delta) > 1e-9 && Math.sign(delta) !== wantSign) {
            t += 360 * wantSign;
            delta = t - current;
        }
        return t;
    }

    // Exactly one full turn in dir, then land on targetAngleDeg (equivalent rep).
    function computeFullTurnTarget(targetAngleDeg: number, current: number, dir: 1 | -1) {
        const turn = -360 * dir; // forward(CCW) is negative
        const wantSign = Math.sign(turn);

        let t = normalizeNearest(targetAngleDeg, current);

        const d0 = t - current;
        if (Math.abs(d0) > 1e-9 && Math.sign(d0) !== wantSign) {
            t += 360 * wantSign;
        }

        return t + turn;
    }

    // One full turn first, THEN land on pointerAngleDeg.
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
        // spokes are at -stepDeg * i
        // pointer is rotated by displayAngle
        const raw = (-angleDeg) / stepDeg;
        const i = Math.round(raw);
        return mod(i, spokeCount);
    }

    let nearestSpokeIndex = 0;

    // use the *displayed* angle (same as pointer transform) so highlight follows animation smoothly
    $: nearestSpokeIndex = nearestSpokeIndexFromAngle(safeAngle(displayAngle, 0));

    // Reactive: drive displayAngle
    $: {
        // guard: never let NaN enter the system
        const current = safeAngle(lastAngle, 0);
        lastAngle = current;

        const ptr = safeAngle(pointerAngleDeg, lastAngle);
        const dir0 = safeDir(timeDir);

        // 1) lock — highest priority
        if (spinLock) {
            const t = safeAngle(spinLockTarget, lastAngle);
            displayAngle = t;
            lastAngle = t;
        }
        // 2) explicit spin command (←/→)
        else if (spinCmd && spinCmd.id !== lastSpinCmdId) {
            lastSpinCmdId = spinCmd.id;

            const cmdDir: 1 | -1 = spinCmd.dir;
            const targetBase = safeAngle(spinCmd.targetAngleDeg, lastAngle);
            const target = computeFullTurnTarget(targetBase, lastAngle, cmdDir);

            startSpinLock(target);
            displayAngle = target;
            lastAngle = target;
        }
        // 3) preTurn (big jump): exactly one full turn, then next tick lands naturally
        else if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
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
        }
        // 4) normal movement: keep continuity + follow time direction if known
        else {
            const t = normalizeByDirection(ptr, lastAngle, dir0);
            displayAngle = t;
            lastAngle = t;
        }
    }

    function handleSpokeActivate(i: number) {
        clearSnapMode();
        onSelectSpoke(i);
    }

    function handleNextE() {
        clearSnapMode();
        onSelectNextE();

        resetTimer = setTimeout(() => {
            noTransition = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    noTransition = false;
                });
            });
        }, POINTER_ANIM_MS);
    }

    onDestroy(() => {
        if (resetTimer) clearTimeout(resetTimer);
        if (spinLockTimer) clearTimeout(spinLockTimer);
    });
</script>

<svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Wheel">
    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />
    <!-- quadrant tint ring -->
    <g class="quadrants" aria-hidden="true" transform={`rotate(90 ${cx} ${cy})`}>
        <!-- SE(-45) -> NE(-135) : RED -->
        <path d={ringSectorPath(-45, -135)} class="q q-red" />
        <!-- NE(-135) -> NW(-225) : WHITE -->
        <path d={ringSectorPath(-135, -225)} class="q q-white" />
        <!-- NW(-225) -> SW(-315) : BLUE -->
        <path d={ringSectorPath(-225, -315)} class="q q-blue" />
        <!-- SW(-315) -> SE(-405) : GOLD -->
        <path d={ringSectorPath(-315, -405)} class="q q-gold" />
    </g>

    {#each labels as label, i (label)}
        {@const a = spokeAngleDeg(i)}
        {@const p1 = polarToXY(rInner, a)}
        {@const p2 = polarToXY(rOuter, a)}
        {@const pt = polarToXY(rLabel, a)}

        <g
                class="spoke"
                role="button"
                tabindex="0"
                aria-label={`Spoke ${label}`}
                on:click={() => handleSpokeActivate(i)}
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
                    stroke-width={i % 4 === 0 ? 7 : 4}
                    stroke-linecap="round"
            />

            {#if showLabels}
                {#if i === nearestSpokeIndex}
                    <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={VB * 0.054}
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
                        font-size={VB * 0.042}
                        fill="currentColor"
                        fill-opacity={selectedSpokeIndex === i ? 1 : 0.65}
                >
                    {label}
                </text>

                {#if i === 0}
                    {@const pt2 = { x: pt.x + 5, y: pt.y + VB * 0.06 }}

                    <g class="eplus">
                        <circle
                                class="eplusHit"
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
            {/if}

            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
        </g>
    {/each}

    {#if showNowPointer && nowPointerAngleDeg !== null}
        <g
                class="nowPointer"
                transform={`rotate(${safeAngle(nowDisplayAngle, 0)} ${cx} ${cy})`}
        >
            <line
                    x1={cx} y1={cy}
                    x2={cx + rOuter} y2={cy}
                    stroke="var(--accent-live)"
                    stroke-width="10"
                    stroke-linecap="round"
                    stroke-opacity="0.35"
            />

            <!-- кликабельная точка: вернуть в LIVE -->
            <circle
                    cx={cx + rOuter}
                    cy={cy}
                    r={VB * 0.018}
                    fill="var(--accent-live)"
                    fill-opacity="0.65"
                    role="button"
                    tabindex="0"
                    aria-label="Go LIVE (now)"
                    on:click|stopPropagation={onClickNow}
                    on:keydown|stopPropagation={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickNow();
        }
      }}
            />
        </g>
    {/if}

    <g
            class="pointer"
            class:noTransition={noTransition}
            transform={`rotate(${safeAngle(displayAngle, 0)} ${cx} ${cy})`}
    >
        <line
                x1={cx} y1={cy}
                x2={cx + rOuter} y2={cy}
                stroke="currentColor"
                stroke-width="9"
                stroke-linecap="round"
        />
        <circle cx={cx + rOuter} cy={cy} r={VB * 0.02} fill="currentColor" />
    </g>

    <circle cx={cx} cy={cy} r={VB * 0.012} fill="currentColor" />
</svg>

<style>
    svg { color: var(--fg); }
    .spoke { cursor: pointer; user-select: none; }

    .pointer { transition: transform 420ms ease; }
    .pointer.noTransition { transition: none; }

    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 65%);
        outline-offset: 4px;
    }
    .quadrants .q{
        fill-opacity: 0.16;          /* можно 0.12..0.22 */
        stroke: none;
    }

    .quadrants .q-red   { fill: var(--accent-red); }
    .quadrants .q-white { fill: var(--accent-white); }
    .quadrants .q-blue  { fill: var(--accent-blue); }
    .quadrants .q-gold  { fill: var(--accent-gold); }
    .nowPointer { transition: transform 420ms ease; }
    .nowPointer circle {
        cursor: pointer;
    }
    .nowPointer:hover line,
    .nowPointer:hover circle {
        stroke-opacity: 0.85;
        fill-opacity: 0.9;
    }
    .spokeLabel{
        transition: fill-opacity 120ms ease, transform 120ms ease;
        pointer-events: auto;
    }

    /* оставь для обычных меток */
    .spokeLabel:hover{
        fill-opacity: 1;
        transform: scale(1.01);
        filter: drop-shadow(0 0 6px color-mix(in oklab, var(--fg), transparent 55%));
    }

    /* а для E+ — по группе (потому что сверху hit-circle) */
    .eplus:hover .eplusLabel{
        fill-opacity: 1;
        transform: scale(1.01);
        filter: drop-shadow(0 0 6px color-mix(in oklab, var(--fg), transparent 55%));
    }
</style>