<!-- src/components/WheelHeader.svelte -->
<script lang="ts">
    import WheelControl from './WheelControl.svelte';
    import { boardApi } from '../lib/board/store';
    import type { BoardWheel } from '../lib/board/types';

    export let wheel: BoardWheel;
    export let onClose: () => void;
    export let onDocs: (() => void) | null = null;
    // опционально: переопределить логику моб/десктоп позже
    export let moveWheelOpts: (() => { carouselWrap: boolean }) | null = null;

    function opts() {
        return moveWheelOpts ? moveWheelOpts() : { carouselWrap: false };
    }

    $: wheelId = wheel?.wheelId ?? '';

    function move(dir: -1 | 1) {
        if (!wheelId) return;
        boardApi.moveWheelById(wheelId, dir, opts(), 'WheelHeader.move');
    }
</script>

<header class="top">
    <div class="left">
        <WheelControl type={wheel.wheelType}
                roles={wheel.roles}
                title={wheel.title}
                baseObserver={wheel.observer}
                baseTime={wheel.time}
                baseWheelId={wheel.wheelId}/>
    </div>

    <div class="right">
        <button type="button" class="navBtn" title="Move left" on:click={() => move(-1)}>⇤</button>
        <button type="button" class="navBtn" title="Move right" on:click={() => move(1)}>⇥</button>
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
    }
    .left { display: grid; gap: 10px; min-width: 0; }
    .right { display: flex; gap: 10px; }
    .navBtn {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }
    .navBtn:hover:not(:disabled) {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 10%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }
    .navBtn:disabled { opacity: 0.45; cursor: default; transform: none; }
    .navBtn.danger:hover:not(:disabled) {
        border-color: color-mix(in oklab, var(--accent-red), transparent 45%);
        background: color-mix(in oklab, var(--accent-red), transparent 86%);
    }
</style>
