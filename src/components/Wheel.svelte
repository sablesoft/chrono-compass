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

    // Choose equivalent representation so that delta sign matches time direction.
    // dir semantics here:
    //  dir =  1 => want negative delta (CCW)
    //  dir = -1 => want positive delta (CW)
    function normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = baseAngle;

        // keep numbers bounded
        while (t - current > 720) t -= 360;
        while (t - current < -720) t += 360;

        if (dir === 0) return t;

        const wantSign = dir > 0 ? -1 : 1; // forward => negative, back => positive

        let delta = t - current;

        // shift by full turns until delta has the wanted sign
        while (Math.sign(delta) !== wantSign) {
            t += 360 * wantSign;
            delta = t - current;
        }

        // if exactly same angle, still move one full turn in direction (so we don't "freeze")
        if (Math.abs(delta) < 1e-9) t += 360 * wantSign;

        return t;
    }

    // Exactly one full turn in cmd.dir, then land on targetAngleDeg (same direction, no “reverse”).
    function computeSpinCmdTarget(targetAngleDeg: number, current: number, dir: 1 | -1) {
        // dir=1 => forward => CCW => negative
        // dir=-1 => back    => CW  => positive
        const landing = normalizeByDirection(targetAngleDeg, current, dir);
        let target = landing + (-360 * dir); // one extra full turn in the SAME direction

        // ensure it really looks like a spin (not almost-zero due to numeric weirdness)
        const delta = target - current;
        if (Math.abs(delta) < 300) target += (-360 * dir);

        return target;
    }

    // One full turn first, THEN land on the *current* pointerAngleDeg, in given dir.
    function computePreTurnTarget(currentTargetAngle: number, current: number, dir: 1 | -1) {
        const landing = normalizeByDirection(currentTargetAngle, current, dir);
        let target = landing + (-360 * dir);

        const delta = target - current;
        if (Math.abs(delta) < 300) target += (-360 * dir);

        return target;
    }

    function startSpinLock(target: number) {
        spinLock = true;
        spinLockTarget = target;

        if (spinLockTimer) clearTimeout(spinLockTimer);
        spinLockTimer = setTimeout(() => {
            spinLock = false;
            spinLockTimer = null;
        }, POINTER_ANIM_MS + 20);
    }

    // Reactive: drive displayAngle
    $: {
        // 0) lock — highest priority
        if (spinLock) {
            displayAngle = spinLockTarget;
            lastAngle = spinLockTarget;
        } else {
            // base “idle” target must ALSO respect time direction,
            // otherwise after a command finishes you get a “reverse correction”.
            let target = normalizeByDirection(pointerAngleDeg, lastAngle, timeDir);

            // 1) preTurn: one full turn, then land on pointerAngleDeg
            if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
                lastPreTurnCmdId = preTurnCmd.id;

                if (timeDir !== 0) {
                    target = computePreTurnTarget(pointerAngleDeg, lastAngle, preTurnCmd.dir);
                    startSpinLock(target);
                } else {
                    // no direction => just snap
                    target = pointerAngleDeg;
                }
            }

            // 2) spinCmd: exactly one full turn + land on cmd.targetAngleDeg
            // spinCmd overrides preTurn if both arrive same tick
            if (spinCmd && spinCmd.id !== lastSpinCmdId) {
                lastSpinCmdId = spinCmd.id;

                target = computeSpinCmdTarget(spinCmd.targetAngleDeg, lastAngle, spinCmd.dir);
                startSpinLock(target);
            }

            displayAngle = target;
            lastAngle = target;
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

    /* IMPORTANT: transition applies to presentation attribute 'transform' in many browsers,
       but if you ever switch back to CSS transform, keep duration same as POINTER_ANIM_MS */
    .pointer { transition: transform 420ms ease; }
    .pointer.noTransition { transition: none; }

    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid rgba(231, 231, 234, 0.35);
        outline-offset: 4px;
    }
</style>