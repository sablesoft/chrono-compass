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

    // Controlled inputs
    export let selectedSpokeIndex: number | null = null; // 0..15 for highlight, null = none
    export let pointerAngleDeg = 0; // any angle (we use negative for CCW-forward)

    // Callbacks
    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    // Internal animation state
    let animAngle = pointerAngleDeg;
    let lastAngle = pointerAngleDeg;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const cx = () => size / 2;
    const cy = () => size / 2;
    const rOuter = () => size * 0.44;
    const rInner = () => size * 0.18;
    const rLabel = () => size * 0.49;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return {
            x: cx() + r * Math.cos(rad),
            y: cy() + r * Math.sin(rad),
        };
    }

    // Spoke geometry: time-forward is CCW => negative angles
    function spokeAngleDeg(i: number) {
        return -stepDeg * i;
    }

    // Keep pointerAngle in a “continuous” representation that matches the direction of time.
    // We do NOT choose the shortest arc; we choose the direction implied by delta sign:
    //  - if target is "ahead" in time, it should rotate CCW (more negative)
    //  - if target is "back" in time, it should rotate CW (more positive)
    function applyTimeDirectedAngle(target: number, current: number) {
        // We want the delta in degrees as-is, not shortest-path.
        // But target might jump between equivalent representations (e.g., 0 and -360).
        // We'll pick the representation that preserves direction (sign) relative to current.
        // Heuristic: keep target within +/- 720 of current, then adjust by 360 steps
        // to keep delta magnitude consistent with raw change, not shortest.
        let t = target;

        // Bring t closer in range first (avoid huge numbers growing forever)
        while (t - current > 720) t -= 360;
        while (t - current < -720) t += 360;

        return t;
    }

    // Reactive: drive animation towards incoming pointerAngleDeg
    $: {
        // If we are in "snap without transition" mode, don't animate
        if (noTransition) {
            animAngle = pointerAngleDeg;
            lastAngle = pointerAngleDeg;
        } else {
            const t = applyTimeDirectedAngle(pointerAngleDeg, lastAngle);
            animAngle = t;
            lastAngle = t;
        }
    }

    function handleSpokeActivate(i: number) {
        onSelectSpoke(i);
    }

    function handleNextE() {
        if (resetTimer) clearTimeout(resetTimer);

        // We assume parent will advance cycle and set pointerAngleDeg accordingly.
        // Here we only do the visual "snap" trick to avoid an extra spin when
        // parent switches from end-of-cycle angle back to 0° (same direction).
        // Strategy:
        // 1) let parent animate to end-of-cycle by setting pointerAngleDeg near -360
        // 2) after animation duration, parent will likely set pointerAngleDeg to 0 (new cycle start)
        // 3) we temporarily disable transition for that snap
        noTransition = false;

        onSelectNextE();

        // Disable transition slightly after click so the “to end of cycle” part still animates.
        // Parent should set end-of-cycle immediately; snap back to 0 happens after its logic.
        // We just give an escape hatch: parent can call nextE and then set angle to 0 later.
        resetTimer = setTimeout(() => {
            noTransition = true;
            requestAnimationFrame(() => {
                // Re-enable transitions next frame after snap has applied
                requestAnimationFrame(() => {
                    noTransition = false;
                });
            });
        }, POINTER_ANIM_MS);
    }

    onDestroy(() => {
        if (resetTimer) clearTimeout(resetTimer);
    });
</script>

<svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
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
    .spoke:focus {
        outline: none;
    }

    .spoke:focus-visible {
        outline: 2px solid rgba(231, 231, 234, 0.35);
        outline-offset: 4px;
    }
</style>
