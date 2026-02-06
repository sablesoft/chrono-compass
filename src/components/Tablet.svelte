<script lang="ts">
    import Header from './tablet/Header.svelte';
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
    export let isLandscape = true;

    let page = 0;

    let perPage = 2;
    $: perPage = isLandscape ? 2 : 1;

    let pageCount = 1;
    $: pageCount = Math.max(1, Math.ceil(cyclesOrdered.length / perPage));

    $: page = Math.min(page, pageCount - 1);

    function clampPage(p: number) {
        if (p < 0) return 0;
        if (p > pageCount - 1) return pageCount - 1;
        return p;
    }

    function next() { page = clampPage(page + 1); }
    function prev() { page = clampPage(page - 1); }

    let startIndex = 0;
    $: startIndex = page * perPage;

    let leftKind: CycleKind | null = null;
    let rightKind: CycleKind | null = null;

    $: leftKind = cyclesOrdered[startIndex] ?? null;
    $: rightKind = perPage === 2 ? (cyclesOrdered[startIndex + 1] ?? null) : null;

    function labelOf(k: CycleKind | null) {
        if (!k) return '';
        return CYCLE_META[k]?.label ?? String(k);
    }

    let title = '';
    $: title = perPage === 2
        ? `${labelOf(leftKind)}  ·  ${labelOf(rightKind)}`
        : `${labelOf(leftKind)}`;

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
            title={title}
            page={page}
            pageCount={pageCount}
            onPrev={prev}
            onNext={next}
            isLandscape={isLandscape}
    />

    <section class="wrap">
        {#if perPage === 2}
            <div class="two">
                {#if leftKind}
                    <Wheel kind={leftKind} lat={lat} lon={lon} selectedTs={selectedTs} />
                {/if}
                {#if rightKind}
                    <Wheel kind={rightKind} lat={lat} lon={lon} selectedTs={selectedTs} />
                {/if}
            </div>
        {:else}
            <div class="one">
                {#if leftKind}
                    <Wheel kind={leftKind} lat={lat} lon={lon} selectedTs={selectedTs} />
                {/if}
            </div>
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
        padding: 10px 12px 14px 12px;
    }

    .two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        align-items: start;
    }

    .one {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
    }
</style>
