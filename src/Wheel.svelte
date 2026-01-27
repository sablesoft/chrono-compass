<script lang="ts">
    import { onDestroy } from 'svelte';

    const labels = [
        'E','ENE','NE','NNE',
        'N','NNW','NW','WNW',
        'W','WSW','SW','SSW',
        'S','SSE','SE','ESE'
    ] as const;

    const NEXT_E_INDEX = 16;
    const spokeCount = 16;
    const stepDeg = 360 / spokeCount;
    const POINTER_ANIM_MS = 420;

    export let size = 360;
    export let selectedIndex = 0;
    export let showLabels = true;

    export let onSelect: (index: number) => void = () => {};

    let currentIndex = selectedIndex;
    let animAngle = angleDeg(currentIndex);
    let suppressNextAnim = false;
    let noTransition = false;

    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const cx = () => size / 2;
    const cy = () => size / 2;
    const rOuter = () => size * 0.44;
    const rInner = () => size * 0.18;
    const rLabel = () => size * 0.49;

    function angleDeg(i: number) {
        // движение времени = против часовой
        return -stepDeg * i;
    }

    function polarToXY(r: number, deg: number) {
        const rad = (deg * Math.PI) / 180;
        return {
            x: cx() + r * Math.cos(rad),
            y: cy() + r * Math.sin(rad),
        };
    }

    function onSpokeClick(i: number) {
        if (resetTimer) clearTimeout(resetTimer);

        onSelect(i);

        if (i === NEXT_E_INDEX) {
            resetTimer = setTimeout(() => {
                // выключаем transition на один кадр
                noTransition = true;

                // принудительно синхронизируем состояние
                currentIndex = 0;
                animAngle = angleDeg(0);

                suppressNextAnim = true;
                onSelect(0);

                requestAnimationFrame(() => {
                    noTransition = false;
                });
            }, POINTER_ANIM_MS);
        }
    }

    onDestroy(() => {
        if (resetTimer) clearTimeout(resetTimer);
    });

    $: {
        if (suppressNextAnim) {
            suppressNextAnim = false;
        } else {
            const targetIndex =
                selectedIndex === NEXT_E_INDEX ? spokeCount : selectedIndex;

            const delta = targetIndex - currentIndex;

            if (delta !== 0) {
                animAngle += -stepDeg * delta;
                currentIndex = targetIndex;
            }
        }
    }
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
        {@const a = angleDeg(i)}
        {@const p1 = polarToXY(rInner(), a)}
        {@const p2 = polarToXY(rOuter(), a)}
        {@const pt = polarToXY(rLabel(), a)}

        <g
                class="spoke"
                role="button"
                tabindex="0"
                on:click={() => onSpokeClick(i)}
                on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSpokeClick(i);
        }
      }}
        >
            <line
                    x1={p1.x} y1={p1.y}
                    x2={p2.x} y2={p2.y}
                    stroke="currentColor"
                    stroke-opacity={i === selectedIndex ? 0.9 : 0.35}
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
                        fill-opacity={i === selectedIndex ? 1 : 0.65}
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
                            fill-opacity={selectedIndex === NEXT_E_INDEX ? 1 : 0.55}
                    >
                        E+
                    </text>

                    <circle
                            cx={pt2.x}
                            cy={pt2.y}
                            r={size * 0.04}
                            fill="transparent"
                            on:click|stopPropagation={() => onSpokeClick(NEXT_E_INDEX)}
                            role="button"
                            tabindex="0"
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
    svg {
        color: #e7e7ea;
    }

    .spoke {
        cursor: pointer;
        user-select: none;
    }

    .pointer {
        transition: transform 420ms ease;
    }

    .pointer.noTransition {
        transition: none;
    }
</style>
