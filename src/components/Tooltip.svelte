<!-- src/components/Tooltip.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { MarkerCluster, MomentTip } from '../lib/wheel/wheel';
    import { formatDateTime } from '../lib/format';

    export let x = 0;
    export let y = 0;

    // one-off “info” tip (spoke/boundary/anchor)
    export let moment: MomentTip | null = null;

    // marker cluster under cursor/tap
    export let cluster: MarkerCluster | null = null;

    // callbacks
    export let onPickTs: (ts: number) => void = () => {};
    export let onMouseEnter: () => void = () => {};
    export let onMouseLeave: () => void = () => {};
    export let onClose: () => void = () => {};

    // positioning
    const GAP = 12;
    const MAX_W = 360;
    const MAX_H = 280;

    let el: HTMLDivElement | null = null;

    // computed position
    let left = 0;
    let top = 0;

    function clamp(n: number, a: number, b: number) {
        return Math.max(a, Math.min(b, n));
    }

    function updatePosition() {
        // DEBUG_SOLAR_ANOMALISTIClog('Tooltip.updatePosition');
        const vw = window.innerWidth || 1000;
        const vh = window.innerHeight || 800;

        const rect = el?.getBoundingClientRect();
        const w = rect?.width ?? MAX_W;
        const h = rect?.height ?? MAX_H;

        const preferLeft = x + GAP;
        const preferTop = y + GAP;

        left = clamp(preferLeft, 8, Math.max(8, vw - w - 8));
        top = clamp(preferTop, 8, Math.max(8, vh - h - 8));

        if (preferTop + h + 8 > vh) {
            const flippedTop = y - GAP - h;
            top = clamp(flippedTop, 8, Math.max(8, vh - h - 8));
        }

        if (preferLeft + w + 8 > vw) {
            const flippedLeft = x - GAP - w;
            left = clamp(flippedLeft, 8, Math.max(8, vw - w - 8));
        }
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }

    function stop(e: Event) {
        e.stopPropagation();
    }

    // Sort list inside tooltip: stable-ish by ts asc
    $: items = cluster ? [...cluster.items].sort((a, b) => a.ts - b.ts) : [];

    // one boolean to decide what we render
    $: hasContent = !!moment || !!cluster;

    onMount(() => {
        if (hasContent) updatePosition();

        const raf = requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('keydown', onKeyDown);

        return () => cancelAnimationFrame(raf);
    });

    onDestroy(() => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('keydown', onKeyDown);
    });

    // If cursor/tap point changes while open, keep anchored
    $: {
        if (hasContent) queueMicrotask(updatePosition);
    }
</script>

{#if hasContent}
    <div
            class="tip"
            data-tooltip-root
            bind:this={el}
            style={`left:${left}px; top:${top}px;`}
            role="dialog"
            aria-label="Details"
            on:mouseenter={onMouseEnter}
            on:mouseleave={onMouseLeave}
            on:wheel|stopPropagation
            on:click|stopPropagation
            on:mousedown|stopPropagation
    >
        <!-- ========== MomentTip mode ========== -->
        {#if moment}
            <header class="head">
                <div class="title">{moment.label}</div>
                <button class="close" type="button" aria-label="Close" on:click={onClose}>×</button>
            </header>

            <div class="single">
                <div class="row">
                    <span class="emoji">⭘</span>
                    <span class="dt">{formatDateTime(moment.ts)}</span>
                </div>

                {#if moment.desc}
                    <div class="desc">{moment.desc}</div>
                {/if}

                <button class="go" type="button" on:click={() => onPickTs(moment.ts)}>
                    Go to this moment
                </button>
            </div>

            <!-- ========== MarkerCluster mode (old behavior) ========== -->
        {:else if cluster}
            <header class="head">
                <div class="title">
                    {#if cluster.count === 1}
                        {items[0]?.title ?? 'Moment'}
                    {:else}
                        {cluster.count} moments
                    {/if}
                </div>

                <button class="close" type="button" aria-label="Close" on:click={onClose}>×</button>
            </header>

            {#if cluster.count === 1}
                <div class="single">
                    <div class="row">
                        <span class="emoji">{items[0]?.emoji ?? '📍'}</span>
                        <span class="dt">{formatDateTime(items[0].ts)}</span>
                    </div>

                    {#if items[0]?.description}
                        <div class="desc">{items[0].description}</div>
                    {/if}

                    <button class="go" type="button" on:click={() => onPickTs(items[0].ts)}>
                        Go to this moment
                    </button>
                </div>
            {:else}
                <div class="list" tabindex="0" on:wheel|stopPropagation={stop}>
                    {#each items as it (it.id)}
                        <button
                                type="button"
                                class="item"
                                on:click={() => onPickTs(it.ts)}
                                title={it.title}
                        >
                            <div class="left">
                                <span class="emoji">{it.emoji ?? '📍'}</span>
                            </div>

                            <div class="mid">
                                <div class="t">{it.title}</div>
                                {#if it.description}
                                    <div class="d">{it.description}</div>
                                {/if}
                            </div>

                            <div class="right">
                                <div class="dt">{formatDateTime(it.ts)}</div>
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
{/if}

<style>
    .tip {
        position: fixed;
        z-index: 50;
        width: min(360px, calc(100vw - 16px));
        max-height: min(280px, calc(100vh - 16px));
        color: var(--fg);
        background: color-mix(in oklab, var(--bg), black 10%);
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        border-radius: 12px;
        box-shadow: 0 16px 50px rgba(0,0,0,0.35);
        backdrop-filter: blur(8px);
        overflow: hidden;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
    }

    .title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 290px;
    }

    .close {
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: transparent;
        color: var(--fg);
        cursor: pointer;
        line-height: 1;
        font-size: 18px;
        opacity: 0.85;
        transition: opacity 120ms ease, transform 120ms ease, background 120ms ease;
    }
    .close:hover {
        opacity: 1;
        transform: scale(1.03);
        background: color-mix(in oklab, var(--fg), transparent 92%);
    }

    .single {
        padding: 10px 12px 12px;
        display: grid;
        gap: 10px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .emoji {
        width: 36px;
        text-align: center;
        font-size: 40px;
    }

    .dt {
        font-size: 12px;
        opacity: 0.85;
        white-space: nowrap;
    }

    .desc {
        font-size: 12px;
        line-height: 1.35;
        opacity: 0.9;
        max-height: 110px;
        overflow: auto;
        padding-right: 6px;
    }

    .go {
        border: 1px solid color-mix(in oklab, var(--fg), transparent 80%);
        background: color-mix(in oklab, var(--fg), transparent 92%);
        color: var(--fg);
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 650;
        transition: transform 120ms ease, background 120ms ease;
    }
    .go:hover {
        transform: scale(1.01);
        background: color-mix(in oklab, var(--fg), transparent 90%);
    }

    .list {
        overflow: auto;
        max-height: 240px;
        padding: 6px;
        outline: none;
    }

    .item {
        width: 100%;
        text-align: left;
        display: grid;
        grid-template-columns: 28px 1fr auto;
        gap: 10px;
        padding: 8px 8px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fg);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    .item:hover {
        background: color-mix(in oklab, var(--fg), transparent 93%);
        border-color: color-mix(in oklab, var(--fg), transparent 86%);
        transform: translateY(-0.5px);
    }

    .mid {
        min-width: 0;
        display: grid;
        gap: 2px;
    }

    .t {
        font-size: 12.5px;
        font-weight: 650;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .d {
        font-size: 11.5px;
        opacity: 0.75;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .right {
        display: flex;
        align-items: center;
    }

    .list:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--fg), transparent 65%);
        outline-offset: 2px;
        border-radius: 10px;
    }
</style>