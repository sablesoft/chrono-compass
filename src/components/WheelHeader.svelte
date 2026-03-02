<!-- src/components/WheelHeader.svelte -->
<script lang="ts">
    import WheelControl from './WheelControl.svelte';
    import type { BoardWheel } from '../lib/board/types';

    export let wheel: BoardWheel;
    export let onClose: () => void;
    export let onDocs: (() => void) | null = null;
    export let dragEnabled = false;
    export let onDragStart: (e: DragEvent) => void = () => {};
    export let onDragEnd: () => void = () => {};
    export let visualOpen = true;
    export let infoOpen = true;
    export let onToggleVisual: (() => void) | null = null;
    export let onToggleInfo: (() => void) | null = null;
    $: wheelId = wheel?.id ?? '';
</script>

<header class="top">
    <div class="left">
        {#if dragEnabled}
            <button
                    type="button"
                    class="navBtn dragBtn"
                    draggable="true"
                    aria-label="Drag card"
                    title="Drag card"
                    on:dragstart={onDragStart}
                    on:dragend={onDragEnd}
            ></button>
        {/if}
        <WheelControl type={wheel.wheelType}
                roles={wheel.roles}
                title={wheel.title}
                baseObserver={wheel.observer}
                baseTime={wheel.time}
                baseId={wheelId}/>
    </div>

    <div class="right">
        <button
                type="button"
                class="navBtn toggleBtn"
                class:off={!visualOpen}
                title={visualOpen ? 'Hide visual wheel' : 'Show visual wheel'}
                aria-pressed={visualOpen}
                on:click={() => onToggleVisual?.()}
        >◍</button>
        <button
                type="button"
                class="navBtn toggleBtn"
                class:off={!infoOpen}
                title={infoOpen ? 'Hide info block' : 'Show info block'}
                aria-pressed={infoOpen}
                on:click={() => onToggleInfo?.()}
        >☰</button>
        {#if onDocs}
            <button type="button" class="navBtn" title="Docs" on:click={() => onDocs?.()}>i</button>
        {/if}
        <button type="button" class="navBtn danger" title="Close" aria-label="Close" on:click|stopPropagation={onClose}>×</button>
    </div>
</header>

<style>
    .top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
    }
    .left { display: flex; gap: 10px; min-width: 0; align-items: flex-start; }
    .right { display: flex; gap: 10px; }
    .toggleBtn.off {
        opacity: 0.55;
    }
    .dragBtn {
        position: relative;
        z-index: 4;
        pointer-events: auto;
        width: 26px;
        height: 26px;
        padding: 0;
        border-radius: 8px;
        cursor: grab;
        flex: 0 0 auto;
        opacity: 0.78;
        border: 1px solid var(--panel-border);
        background: color-mix(in oklab, var(--panel), transparent 12%);
        margin-top: 1px;
    }
    .dragBtn::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: color-mix(in oklab, var(--fg), transparent 12%);
        transform: translate(-50%, -50%);
        box-shadow:
            -5px -5px 0 color-mix(in oklab, var(--fg), transparent 12%),
            0 -5px 0 color-mix(in oklab, var(--fg), transparent 12%),
            5px -5px 0 color-mix(in oklab, var(--fg), transparent 12%),
            -5px 0 0 color-mix(in oklab, var(--fg), transparent 12%),
            5px 0 0 color-mix(in oklab, var(--fg), transparent 12%),
            -5px 5px 0 color-mix(in oklab, var(--fg), transparent 12%),
            0 5px 0 color-mix(in oklab, var(--fg), transparent 12%),
            5px 5px 0 color-mix(in oklab, var(--fg), transparent 12%);
    }
    .dragBtn:active {
        cursor: grabbing;
    }
</style>
