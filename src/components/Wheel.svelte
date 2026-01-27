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

    //  1  => time forward => CCW (negative degrees)
    // -1  => time back    => CW  (positive degrees)
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

    // Continuous animation state (IMPORTANT: never reset to raw pointerAngle)
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

    // Convert time direction to "degree sign" we must preserve:
    // future => CCW => delta must be NEGATIVE
    // past   => CW  => delta must be POSITIVE
    function degSignFromTimeDir(dir: -1 | 1) {
        return dir === 1 ? -1 : 1; // +1 future => -1 degrees, -1 past => +1 degrees
    }

    // Pick an equivalent representation of baseAngle (±360k) so that:
    // (t - current) has the correct sign (degSign), and is the "nearest" among those.
    function normalizeByDegSign(baseAngle: number, current: number, degSign: 1 | -1) {
        let t = baseAngle;

        // Keep numbers bounded
        while (t - current > 720) t -= 360;
        while (t - current < -720) t += 360;

        // Force desired sign
        while ((t - current) * degSign <= 0) {
            t += 360 * degSign;
        }
        return t;
    }

    // Exactly one full turn in cmd dir, then land on targetAngleDeg (in that direction)
    function computeFullTurnTarget(targetAngleDeg: number, current: number, dir: 1 | -1) {
        // dir=+1 (future) => CCW => degSign=-1
        // dir=-1 (past)   => CW  => degSign=+1
        const degSign = degSignFromTimeDir(dir);

        // First, ensure target is reached in the correct direction
        const base = normalizeByDegSign(targetAngleDeg, current, degSign);

        // Then add ONE guaranteed full cycle in the same direction
        return base + 360 * degSign;
    }

    // One full turn first, THEN land on current pointerAngleDeg (in the same direction)
    function computePreTurnTarget(currentTargetAngle: number, current: number, dir: 1 | -1) {
        const degSign = degSignFromTimeDir(dir);
        const base = normalizeByDegSign(currentTargetAngle, current, degSign);
        return base + 360 * degSign;
    }

    function startSpinLock(target: number) {
        spinLock = true;
        spinLockTarget = target;

        if (spinLockTimer) clearTimeout(spinLockTimer);
        spinLockTimer = setTimeout(() => {
            spinLock = false;
            spinLockTimer = null;
        }, POINTER_ANIM_MS + 30);
    }

    // Reactive: drive displayAngle
    $: {
        // 1) lock — самый высокий приоритет
        if (spinLock) {
            displayAngle = spinLockTarget;
            lastAngle = spinLockTarget;
        } else {
            // default movement: follow pointerAngleDeg but ONLY in timeDir (if known)
            let target = pointerAngleDeg;

            if (timeDir !== 0) {
                const degSign = degSignFromTimeDir(timeDir);
                target = normalizeByDegSign(pointerAngleDeg, lastAngle, degSign);
            } else {
                // no direction info => keep it "close-ish" without forcing sign
                // (so it doesn’t drift infinitely)
                while (target - lastAngle > 180) target -= 360;
                while (target - lastAngle < -180) target += 360;
            }

            // 2) preTurn (дальний прыжок) — ниже spinCmd
            if (preTurnCmd && preTurnCmd.id !== lastPreTurnCmdId) {
                lastPreTurnCmdId = preTurnCmd.id;

                const t = computePreTurnTarget(pointerAngleDeg, lastAngle, preTurnCmd.dir);
                startSpinLock(t);
                target = t;
            }

            // 3) explicit spin command (←/→) — главный приоритет
            if (spinCmd && spinCmd.id !== lastSpinCmdId) {
                const t = computeFullTurnTarget(spinCmd.targetAngleDeg, lastAngle, spinCmd.dir);
                lastSpinCmdId = spinCmd.id;
                startSpinLock(t);
                target = t;
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

    .pointer { transition: transform 420ms ease; }
    .pointer.noTransition { transition: none; }

    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid rgba(231, 231, 234, 0.35);
        outline-offset: 4px;
    }
</style>