<script lang="ts">
    import { onDestroy } from 'svelte';
    import type { SpinCmd, PreTurnCmd } from '../lib/cycles/types';

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

    // “если прыжок > цикл: 1 круг + до E + до target”
    export let preTurnCmd: PreTurnCmd | null = null;

    export let selectedSpokeIndex: number | null = null;
    export let pointerAngleDeg = 0;

    //  1  => time forward => CCW (negative)
    // -1  => time back    => CW  (positive)
    //  0  => unknown
    export let timeDir: -1 | 0 | 1 = 0;

    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    // --- Geometry (single coordinate space)
    const VB = 1000;
    const cx = VB / 2;
    const cy = VB / 2;

    const rOuter = VB * 0.42;
    const rInner = VB * 0.18;
    const rLabel = VB * 0.48;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function spokeAngleDeg(i: number) {
        return -stepDeg * i; // time-forward is CCW => negative
    }

    // --- Animation state (continuous)
    let displayAngle = pointerAngleDeg;
    let lastAngle = pointerAngleDeg;

    let lastSpinCmdId = 0;
    let lastPreTurnCmdId = 0;

    // lock while doing a forced spin (pre-turn or spinCmd)
    let spinLock = false;
    let spinLockTarget = 0;
    let spinLockTimer: ReturnType<typeof setTimeout> | null = null;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function clearSnapMode() {
        if (resetTimer) {
            clearTimeout(resetTimer);
            resetTimer = null;
        }
        noTransition = false;
    }

    // --- helpers: directional movement on circle

    function mod360(a: number) {
        let m = a % 360;
        if (m < 0) m += 360;
        return m;
    }

    // Signed delta from "fromAngle" to "toAngle" moving strictly in the given direction.
    // dir=1 (forward/CCW) => negative delta in [-359..0]
    // dir=-1 (back/CW)    => positive delta in [0..359]
    function deltaInDir(fromAngle: number, toAngle: number, dir: 1 | -1): number {
        const f = mod360(fromAngle);
        const t = mod360(toAngle);

        if (dir === 1) {
            // CCW => angle decreases
            return -((f - t + 360) % 360);
        } else {
            // CW => angle increases
            return ((t - f + 360) % 360);
        }
    }

    // Normal move (< cycle): minimal movement but ONLY in time direction
    function computeDirectedTarget(toAngle: number, current: number, dir: 1 | -1): number {
        const d = deltaInDir(current, toAngle, dir);
        // if d=0, do nothing (no forced spin)
        return current + d;
    }

    // Button spin: exactly one full turn in dir, then land on targetAngleDeg (same direction, no shortest-path)
    function computeFullTurnTarget(targetAngleDeg: number, current: number, dir: 1 | -1): number {
        const turn = -360 * dir; // forward(CCW) negative
        const afterOneTurn = current + turn;

        // from that point, move in same dir to target (minimal in that dir)
        const d = deltaInDir(afterOneTurn, targetAngleDeg, dir);
        return afterOneTurn + d;
    }

    // Big jump: 1 full turn returning to same angle, then go to E(0), then to target — all in same dir
    function computePreTurnTarget(targetAngleDeg: number, current: number, dir: 1 | -1): number {
        const turn = -360 * dir;

        // 1) full cycle back to same angle
        const a1 = current + turn;

        // 2) to E (0)
        const toE = deltaInDir(a1, 0, dir);
        const a2 = a1 + toE;

        // 3) from E to target
        const toT = deltaInDir(a2, targetAngleDeg, dir);
        return a2 + toT;
    }

    function startSpinLock(target: number) {
        spinLock = true;
        spinLockTarget = target;

        if (spinLockTimer) clearTimeout(spinLockTimer);
        spinLockTimer = setTimeout(() => {
            spinLock = false;
        }, POINTER_ANIM_MS + 20);
    }

    // Reactive: drive displayAngle
    $: {
        // lock has top priority
        if (spinLock) {
            displayAngle = spinLockTarget;
            lastAngle = spinLockTarget;
        } else {
            // determine direction for normal motion
            const dir: 1 | -1 | null =
                timeDir === 0 ? null : (timeDir > 0 ? 1 : -1);

            // 1) explicit spin command (←/→) overrides everything
            if (spinCmd && spinCmd.id !== lastSpinCmdId) {
                const d = spinCmd.dir; // 1|-1
                const target = computeFullTurnTarget(spinCmd.targetAngleDeg, lastAngle, d);

                lastSpinCmdId = spinCmd.id;
                startSpinLock(target);

                displayAngle = target;
                lastAngle = target;
            }
            // 2) preTurn (big external jump): 1 turn + to E + to target
            else if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
                lastPreTurnCmdId = preTurnCmd.id;

                const d = preTurnCmd.dir; // 1|-1
                const target = computePreTurnTarget(pointerAngleDeg, lastAngle, d);

                startSpinLock(target);

                displayAngle = target;
                lastAngle = target;
            }
            // 3) normal movement: directed by time (not-shortest path)
            else if (dir) {
                const target = computeDirectedTarget(pointerAngleDeg, lastAngle, dir);
                displayAngle = target;
                lastAngle = target;
            }
            // 4) no direction known: snap (safe default)
            else {
                displayAngle = pointerAngleDeg;
                lastAngle = pointerAngleDeg;
            }
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