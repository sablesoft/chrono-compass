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

    export let size = 340;          // внешний размер SVG (px)
    export let showLabels = true;

    export let spinCmd: { id: number; dir: 1 | -1 } | null = null;

    export let selectedSpokeIndex: number | null = null;
    export let pointerAngleDeg = 0;

    export let onSelectSpoke: (index: number) => void = () => {};
    export let onSelectNextE: () => void = () => {};

    let lastSpinCmdId = 0;
    let pendingExtraDeg = 0;

    let animAngle = pointerAngleDeg;

    let noTransition = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const safe = () => 2; // px. спасает от субпикселей + толщин линий
    const pad = () => Math.ceil(size * 0.09) + safe();
    const innerSize = () => size - pad() * 2;

    const cx = () => size / 2;
    const cy = () => size / 2;

    // радиусы считаем от innerSize, чтобы всё гарантированно влезло
    const rOuter = () => innerSize() * 0.44;
    const rInner = () => innerSize() * 0.18;
    const rLabel = () => innerSize() * 0.50;

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx() + r * Math.cos(rad), y: cy() + r * Math.sin(rad) };
    }

    function spokeAngleDeg(i: number) {
        return -stepDeg * i;
    }

    $: {
        if (spinCmd && spinCmd.id !== lastSpinCmdId) {
            pendingExtraDeg += -360 * spinCmd.dir;
            lastSpinCmdId = spinCmd.id;
        }

        const target = pointerAngleDeg + pendingExtraDeg;

        if (noTransition) {
            animAngle = target;
        } else {
            animAngle = target;
        }

        pendingExtraDeg = 0;
    }

    function handleSpokeActivate(i: number) {
        onSelectSpoke(i);
    }

    function handleNextE() {
        if (resetTimer) clearTimeout(resetTimer);

        noTransition = false;
        onSelectNextE();

        resetTimer = setTimeout(() => {
            noTransition = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { noTransition = false; });
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
                        font-size={innerSize() * 0.045}
                        fill="currentColor"
                        fill-opacity={selectedSpokeIndex === i ? 1 : 0.7}
                >
                    {label}
                </text>

                {#if i === 0}
                    {@const pt2 = { x: pt.x, y: pt.y + innerSize() * 0.06 }}

                    <text
                            x={pt2.x} y={pt2.y}
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size={innerSize() * 0.038}
                            fill="currentColor"
                            fill-opacity={0.65}
                    >
                        E+
                    </text>

                    <circle
                            cx={pt2.x}
                            cy={pt2.y}
                            r={innerSize() * 0.045}
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

            <circle cx={p2.x} cy={p2.y} r={innerSize() * 0.05} fill="transparent" />
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
        <circle cx={cx() + rOuter()} cy={cy()} r={innerSize() * 0.022} fill="currentColor" />
    </g>

    <circle cx={cx()} cy={cy()} r={innerSize() * 0.012} fill="currentColor" />
</svg>

<style>
    svg { color: #e7e7ea; display: block; }
    .spoke { cursor: pointer; user-select: none; }
    .pointer { transition: transform 420ms ease; }
    .pointer.noTransition { transition: none; }
    .spoke:focus { outline: none; }
    .spoke:focus-visible {
        outline: 2px solid rgba(231, 231, 234, 0.35);
        outline-offset: 4px;
    }
</style>
