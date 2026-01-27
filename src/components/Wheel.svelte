<script lang="ts">
    import { onDestroy } from 'svelte';
    import type { SpinCmd } from '../lib/cycles/types';

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
    export let timeDir: -1 | 0 | 1 = 0;

    export let spinCmd: SpinCmd | null = null;
    export let selectedSpokeIndex: number | null = null;
    export let pointerAngleDeg = 0;

    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    // viewBox space
    const VB = 1000;
    const cx = VB / 2;
    const cy = VB / 2;

    const rOuter = VB * 0.42;
    const rInner = VB * 0.18;
    const rLabel = VB * 0.48;

    // animation state
    let displayAngle = pointerAngleDeg;

    // state flags
    let noTransition = false;
    let isSpinning = false;

    // bookkeeping
    let lastSpinCmdId = 0;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function spokeAngleDeg(i: number) {
        // forward-in-time is CCW => negative angles
        return -stepDeg * i;
    }

    function normalizeToClosest(baseAngle: number, current: number) {
        let t = baseAngle;
        while (t - current > 180) t -= 360;
        while (t - current < -180) t += 360;
        return t;
    }

    function clearTimers() {
        if (snapTimer) {
            clearTimeout(snapTimer);
            snapTimer = null;
        }
    }

    function cancelSpin() {
        clearTimers();
        isSpinning = false;
        noTransition = false;
    }

    function normalizeInDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        if (dir === 0) return normalizeToClosest(baseAngle, current);

        // CCW forward => we want delta negative when dir=1
        // CW backward => we want delta positive when dir=-1
        const wantSign = dir === 1 ? -1 : 1;

        // start from closest representation
        let t = normalizeToClosest(baseAngle, current);
        let delta = t - current;

        // if delta sign doesn't match desired, push by full turns until it does
        // this enforces long-way travel if needed.
        while (Math.sign(delta) !== wantSign && delta !== 0) {
            t += 360 * wantSign; // if wantSign=-1 => t -= 360
            delta = t - current;
        }

        // Edge case: if exactly same angle (delta=0) but timeDir requests movement,
        // we keep it (no visual move) — this is OK for "same angle different cycle" cases
        // which are handled via spinCmd anyway.
        return t;
    }

    $: if (!isSpinning) {
        displayAngle = normalizeInDirection(pointerAngleDeg, displayAngle, timeDir);
    }

    // 2) handle new spin command (one full turn + snap to clean target)
    $: if (spinCmd && spinCmd.id !== lastSpinCmdId) {
        clearTimers();
        isSpinning = true;

        const turn = -360 * spinCmd.dir; // dir=1 => forward(CCW) => -360
        const clean = normalizeToClosest(spinCmd.targetAngleDeg, displayAngle);
        const spun = clean + turn;

        // animate to spun
        displayAngle = spun;
        lastSpinCmdId = spinCmd.id;

        // after animation, snap silently to clean (and end spinning)
        snapTimer = setTimeout(() => {
            noTransition = true;
            displayAngle = clean;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    noTransition = false;
                    isSpinning = false;
                });
            });

            snapTimer = null;
        }, POINTER_ANIM_MS + 5);
    }

    function handleSpokeActivate(i: number) {
        cancelSpin();
        onSelectSpoke(i);
    }

    function handleNextE() {
        cancelSpin();
        onSelectNextE();
    }

    onDestroy(() => cancelSpin());
</script>

<svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} aria-label="Wheel">
    <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" stroke-opacity="0.25" />
    <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" stroke-opacity="0.18" />

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
                <text
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
                    {@const pt2 = { x: pt.x, y: pt.y + VB * 0.055 }}

                    <text
                            x={pt2.x} y={pt2.y}
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size={VB * 0.034}
                            fill="currentColor"
                            fill-opacity={0.55}
                    >
                        E+
                    </text>

                    <circle
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
            }}
                    />
                {/if}
            {/if}

            <circle cx={p2.x} cy={p2.y} r={VB * 0.045} fill="transparent" />
        </g>
    {/each}

    <g
            class="pointer"
            class:noTransition={noTransition}
            transform={`rotate(${displayAngle} ${cx} ${cy})`}
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
    svg { color: #e7e7ea; }
    .spoke { cursor: pointer; user-select: none; }

    .pointer { transition: transform 420ms ease; }
    .pointer.noTransition { transition: none; }

    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid rgba(231, 231, 234, 0.35);
        outline-offset: 4px;
    }
</style>