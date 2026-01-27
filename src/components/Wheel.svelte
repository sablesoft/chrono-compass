<script lang="ts">
    import { onDestroy } from 'svelte';

    const labels = [
        'E','ENE','NE','NNE',
        'N','NNW','NW','WNW',
        'W','WSW','SW','SSW',
        'S','SSE','SE','ESE'
    ] as const;

    const spokeCount = 16;
    const stepDeg = 360 / spokeCount;
    const POINTER_ANIM_MS = 420;

    // UI
    export let size = 360;
    export let showLabels = true;

    // one-shot spin command from parent
    export let spinCmd: { id: number; dir: 1 | -1 } | null = null;

    // Controlled inputs
    export let selectedSpokeIndex: number | null = null; // 0..15 for highlight, null = none
    export let pointerAngleDeg = 0; // base angle (E=0, N=-90, ...)

    // Callbacks
    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    let lastSpinCmdId = 0;

    // Internal animation state (continuous angle)
    let animAngle = pointerAngleDeg;
    let lastAngle = pointerAngleDeg;

    // Spin lock: while active, ignore reactive base changes and keep fixed target
    let spinLock = false;
    let spinLockTarget = 0;
    let spinLockTimer: ReturnType<typeof setTimeout> | null = null;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const pad = () => size * 0.05;
    const cx = () => (size + pad() * 2) / 2;
    const cy = () => (size + pad() * 2) / 2;
    const rOuter = () => size * 0.44;
    const rInner = () => size * 0.18;
    const rLabel = () => size * 0.50;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return {
            x: cx() + r * Math.cos(rad),
            y: cy() + r * Math.sin(rad),
        };
    }

    function spokeAngleDeg(i: number) {
        return -stepDeg * i;
    }

    function handleSpokeActivate(i: number) {
        onSelectSpoke(i);
    }

    // Choose an equivalent representation of baseAngle that is closest to current (shortest adjustment).
    function normalizeToClosest(baseAngle: number, current: number) {
        let t = baseAngle;
        while (t - current > 180) t -= 360;
        while (t - current < -180) t += 360;
        return t;
    }

    // Force at least one full turn in given direction, then land on an equivalent of baseAngle.
    // dir=1 => forward => CCW => negative
    // dir=-1 => back    => CW  => positive
    function computeFullTurnTarget(baseAngle: number, current: number, dir: 1 | -1) {
        const turn = -360 * dir;
        // Start with "one turn away from the nearest representation"
        let base = normalizeToClosest(baseAngle, current);
        let target = base + turn;

        // Ensure direction and "really a full turn"
        // (threshold prevents accidental ~0..200deg moves)
        const wantSign = Math.sign(turn);
        let delta = target - current;

        while (Math.sign(delta) !== wantSign || Math.abs(delta) < 300) {
            target += turn;
            delta = target - current;
        }

        return target;
    }

    function startSpinLock(target: number) {
        spinLock = true;
        spinLockTarget = target;

        if (spinLockTimer) clearTimeout(spinLockTimer);
        spinLockTimer = setTimeout(() => {
            spinLock = false;
        }, POINTER_ANIM_MS + 20);
    }

    // Reactive: drive animation
    $: {
        // If we are in the middle of a forced spin, keep its fixed target
        if (spinLock) {
            animAngle = spinLockTarget;
            lastAngle = spinLockTarget;
        } else {
            let target = normalizeToClosest(pointerAngleDeg, lastAngle);

            // New spin command: compute once, lock, and ignore further pointerAngleDeg jitter
            if (spinCmd && spinCmd.id !== lastSpinCmdId) {
                target = computeFullTurnTarget(pointerAngleDeg, lastAngle, spinCmd.dir);
                lastSpinCmdId = spinCmd.id;
                startSpinLock(target);
            }

            if (noTransition) {
                animAngle = target;
                lastAngle = target;
            } else {
                animAngle = target;
                lastAngle = target;
            }
        }
    }

    function handleNextE() {
        if (resetTimer) clearTimeout(resetTimer);

        noTransition = false;
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

<svg
        width={size}
        height={size}
        viewBox={`0 0 ${size + pad() * 2} ${size + pad() * 2}`}
        aria-label="Wheel"
>
    <circle cx={cx()} cy={cy()} r={rOuter()} fill="none" stroke="currentColor" stroke-opacity="0.25" />
    <circle cx={cx()} cy={cy()} r={rInner()} fill="none" stroke="currentColor" stroke-opacity="0.18" />

    {#each labels as label, i (label)}
        {@const a = spokeAngleDeg(i)}
        {@const p1 = polarToXY(rInner(), a)}
        {@const p2 = polarToXY(rOuter(), a)}
        {@const pt = polarToXY(rLabel(), a)}

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
                    stroke-width={i % 4 === 0 ? 2.5 : 1.5}
                    stroke-linecap="round"
            />

            {#if showLabels}
                <text
                        x={pt.x} y={pt.y}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size={size * 0.042}
                        fill="currentColor"
                        fill-opacity={selectedSpokeIndex === i ? 1 : 0.65}
                >
                    {label}
                </text>

                {#if i === 0}
                    {@const pt2 = { x: pt.x, y: pt.y + size * 0.055 }}

                    <text
                            x={pt2.x} y={pt2.y}
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size={size * 0.034}
                            fill="currentColor"
                            fill-opacity={0.55}
                    >
                        E+
                    </text>

                    <circle
                            cx={pt2.x}
                            cy={pt2.y}
                            r={size * 0.04}
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

            <circle cx={p2.x} cy={p2.y} r={size * 0.045} fill="transparent" />
        </g>
    {/each}

    <g
            class="pointer"
            class:noTransition={noTransition}
            style={`transform: rotate(${animAngle}deg); transform-origin: ${cx()}px ${cy()}px;`}
    >
        <line
                x1={cx()} y1={cy()}
                x2={cx() + rOuter()} y2={cy()}
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
        />
        <circle cx={cx() + rOuter()} cy={cy()} r={size * 0.02} fill="currentColor" />
    </g>

    <circle cx={cx()} cy={cy()} r={size * 0.012} fill="currentColor" />
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
