<!-- src/components/Wheel.svelte -->
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

    export let spinCmd: SpinCmd | null = null;     // “ровно 1 оборот + приземление на targetAngleDeg”
    export let preTurnCmd: PreTurnCmd | null = null; // “сделай 1 полный оборот, потом приземлись на pointerAngleDeg”

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

    // Choose equivalent representation so that we don't "snap back" by 360,
    // and (if dir known) so that delta sign matches time direction.
    function normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = baseAngle;

        // keep numbers bounded
        while (t - current > 720) t -= 360;
        while (t - current < -720) t += 360;

        if (dir === 0) {
            // pick the nearest equivalent (avoid huge jumps)
            while (t - current > 180) t -= 360;
            while (t - current < -180) t += 360;
            return t;
        }

        // future => CCW => negative delta
        // past   => CW  => positive delta
        const wantSign = dir > 0 ? -1 : 1;

        let delta = t - current;

        // shift by full turns until sign matches
        while (Math.sign(delta) !== wantSign && Math.abs(delta) > 1e-9) {
            t += 360 * wantSign;
            delta = t - current;
        }

        // if exactly same, still keep "motion direction" continuity
        if (Math.abs(delta) < 1e-9) t += 360 * wantSign;

        return t;
    }

    // Exactly one full turn in dir, then land on targetAngleDeg (equivalent rep).
    function computeFullTurnTarget(targetAngleDeg: number, current: number, dir: 1 | -1) {
        const turn = -360 * dir; // forward(CCW) negative
        const wantSign = Math.sign(turn);

        // normalize target near current first
        let t = targetAngleDeg;
        while (t - current > 720) t -= 360;
        while (t - current < -720) t += 360;

        // ensure landing delta sign matches the spin direction
        while (Math.sign(t - current) !== wantSign && Math.abs(t - current) > 1e-9) {
            t += 360 * wantSign;
        }

        // add exactly one requested full turn
        t += turn;

        // ensure it's visually a real spin (not tiny)
        while (Math.abs(t - current) < 300) t += turn;

        return t;
    }

    // One full turn first, THEN land on pointerAngleDeg (current target)
    function computePreTurnTarget(currentTargetAngle: number, current: number, dir: 1 | -1) {
        const base = normalizeByDirection(currentTargetAngle, current, dir);
        return base + (-360 * dir);
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
        // 1) lock — highest priority
        if (spinLock) {
            displayAngle = spinLockTarget;
            lastAngle = spinLockTarget;
        }
        // 2) explicit spin command (←/→)
        else if (spinCmd && spinCmd.id !== lastSpinCmdId) {
            const target = computeFullTurnTarget(spinCmd.targetAngleDeg, lastAngle, spinCmd.dir);

            lastSpinCmdId = spinCmd.id;
            startSpinLock(target);

            displayAngle = target;
            lastAngle = target;
        }
        // 3) preTurn (big jump)
        else if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
            lastPreTurnCmdId = preTurnCmd.id;

            if (timeDir !== 0) {
                const target = computePreTurnTarget(pointerAngleDeg, lastAngle, preTurnCmd.dir);

                startSpinLock(target);

                displayAngle = target;
                lastAngle = target;
            } else {
                // unknown direction -> snap to nearest equivalent (no wild spins)
                const t = normalizeByDirection(pointerAngleDeg, lastAngle, 0);
                displayAngle = t;
                lastAngle = t;
            }
        }
        // 4) no commands: KEEP CONTINUITY (this is the key fix)
        else {
            const t = normalizeByDirection(pointerAngleDeg, lastAngle, timeDir);
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