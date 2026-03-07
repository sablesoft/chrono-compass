<!-- src/components/WheelHeader.svelte -->
<script lang="ts">
    import WheelProfile from './WheelProfile.svelte';
    import WheelConfig from './WheelConfig.svelte';
    import type { BoardWheel } from '../lib/board/types';

    export let wheel: BoardWheel;
    export let onClose: () => void;
    export let onDocs: (() => void) | null = null;
    export let dragEnabled = false;
    export let onDragStart: (e: DragEvent) => void = () => {};
    export let onDragEnd: () => void = () => {};
    export let visualOpen = true;
    export let infoOpen = true;
    export let pickersOpen = true;
    export let profileLocked = false;
    export let onToggleVisual: (() => void) | null = null;
    export let onToggleInfo: (() => void) | null = null;
    export let onTogglePickers: (() => void) | null = null;
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
        <WheelConfig type={wheel.wheelType}
                roles={wheel.roles}
                title={wheel.title}
                baseObserver={wheel.observer}
                baseTime={wheel.time}
                baseView={wheel.view}
                baseId={wheelId}/>
    </div>

    <div class="btnRail">
        {#if !profileLocked}
            <WheelProfile type={wheel.wheelType}
                    roles={wheel.roles}
                    title={wheel.title}
                    baseObserver={wheel.observer}
                    baseTime={wheel.time}
                    baseView={wheel.view}
                    baseId={wheelId}/>
        {/if}
        {#if onDocs}
            <button type="button" class="navBtn" title="Docs" on:click={() => onDocs?.()}>i</button>
        {/if}
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
        <button
                type="button"
                class="navBtn toggleBtn"
                class:off={!pickersOpen}
                title={pickersOpen ? 'Hide wheel pickers' : 'Show wheel pickers'}
                aria-pressed={pickersOpen}
                on:click={() => onTogglePickers?.()}
        ><span class="pickerGlyph" aria-hidden="true">◷</span></button>
        {#if !profileLocked}
            <button type="button" class="navBtn danger" title="Close" aria-label="Close" on:click|stopPropagation={onClose}>×</button>
        {/if}
    </div>
</header>

<style>
    .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 8px;
    }
    .left { display: flex; gap: 10px; min-width: 0; align-items: center; }

    .btnRail {
        --seg-size: 32px;
        flex: 0 0 auto;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: var(--seg-size);
        border: 1px solid var(--btn-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--btn-bg);
    }

    .btnRail :global(.navBtn) {
        width: 100%;
        height: var(--seg-size);
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-right: 1px solid var(--btn-border);
        border-radius: 0;
        background: transparent;
        display: inline-grid;
        place-items: center;
        line-height: 1;
    }

    .btnRail :global(.navBtn:hover:not(:disabled)) {
        transform: none;
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
    }

    .btnRail :global(.navBtn:last-child) {
        border-right: 0;
    }

    .toggleBtn.off {
        opacity: 0.55;
    }

    .pickerGlyph {
        font-variant-emoji: text;
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
