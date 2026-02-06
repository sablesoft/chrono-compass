<script lang="ts">
    import Header from './mobile/Header.svelte';
    import Wheel from './Wheel.svelte';

    import type { CycleKind } from '../lib/cycles/types';
    import { CYCLE_META } from '../lib/cycles/meta';

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;
    export let cyclesOrdered: CycleKind[] = [];
    export let resetUiId = 0;

    export let viewportWidth = 0;
    export let viewportHeight = 0;
    export let isLandscape = false;

    let index = 0;

    let count = 0;
    $: count = cyclesOrdered.length;

    $: index = Math.max(0, Math.min(index, Math.max(0, count - 1)));

    let kind: CycleKind | null = null;
    $: kind = cyclesOrdered[index] ?? null;

    function next() {
        if (index < count - 1) index += 1;
    }

    function prev() {
        if (index > 0) index -= 1;
    }

    function labelOf(k: CycleKind | null) {
        if (!k) return '';
        return CYCLE_META[k]?.label ?? String(k);
    }

    // swipe
    let touchStartX = 0;
    let touchStartY = 0;
    let touchActive = false;

    function onTouchStart(e: TouchEvent) {
        if (e.touches.length !== 1) return;
        touchActive = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }

    function onTouchEnd(e: TouchEvent) {
        if (!touchActive) return;
        touchActive = false;

        const t = e.changedTouches?.[0];
        if (!t) return;

        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (Math.abs(dx) < 50) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

        if (dx < 0) next();
        else prev();
    }
</script>

<main on:touchstart={onTouchStart} on:touchend={onTouchEnd}>
    <Header
            title={labelOf(kind)}
            index={index}
            count={count}
            onPrev={prev}
            onNext={next}
    />

    <section class="wrap">
        {#if kind}
            <Wheel kind={kind} lat={lat} lon={lon} selectedTs={selectedTs} />
        {/if}
    </section>
</main>

<style>
    main {
        background: var(--bg);
        min-height: 100vh;
        color: var(--fg);
        overflow-x: hidden;
        font-size: 18px;
    }

    .wrap {
        padding: 10px 10px 14px 10px;
    }
</style>
