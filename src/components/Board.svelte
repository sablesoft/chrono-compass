<!--src/component/Board.svelte -->
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { boardApi, boardItems } from '../lib/board/store';
    import { flip } from 'svelte/animate';
    import { currentLocationId, resolveLocationById, savedLocations } from '../lib/location/store';
    import { getWheelEntry } from '../lib/board/registry';
    import { BOARD_GRID_COLUMNS, BOARD_DEFAULT_W, nextFreeRect, normalizeRect } from '../lib/board/layoutEngine';
    import { phoneCarouselState, syncPhoneCarousel } from '../lib/app/phoneCarousel';

    import WheelPicker from "./WheelPicker.svelte";
    import Compass from './Compass.svelte';
    import Cycle from './Cycle.svelte';

    import type {WheelObserverState} from "../lib/wheel/types";
    import type {BoardWheel} from "../lib/board/types";
    import {DEFAULT_LOCATION_ID} from "../lib/location/types";
    import { isActiveProfileLocked } from '../lib/profile/store';
    export let selectedTs: number;
    const GRID_COL_GAP = 10;
    const GRID_ROW_GAP = 10;
    const GRID_ROW_UNIT = 6;

    const compCache = new Map<string, any>();
    let packedEl: HTMLElement | null = null;
    let pickerEl: HTMLElement | null = null;
    let packedWidth = 0;
    let isDesktop = false;
    let isPhone = false;
    let phoneIndex = 0;
    let phoneWheelId: string | null = null;
    let phoneSwipeStartX = 0;
    let phoneSwipeStartY = 0;
    let phoneSwipeTracking = false;
    let phoneSectionEl: HTMLElement | null = null;
    let phoneViewportHeight = 0;
    let mqDesktop: MediaQueryList | null = null;
    let mqPhone: MediaQueryList | null = null;
    let onDesktopChange: (() => void) | null = null;
    let onPhoneChange: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    let dragWheelId: string | null = null;
    const cellEls = new Map<string, HTMLElement>();
    let syncRaf = 0;
    let pickerContentHeight = 220;
    let layoutAnimMs = 0;
    let layoutAnimTimer = 0;
    let resizeState: { id: string; startX: number; startW: number } | null = null;
    let resizeRaf = 0;
    let resizeNextW: number | null = null;
    let lastPhoneCommandSeq = 0;

    function pickComponentStable(w: BoardWheel) {
        const id = w.id;
        const cached = compCache.get(id);
        if (cached) return cached;

        const entry = getWheelEntry(w.wheelType);
        const Comp = entry.ui === 'compass' ? Compass : Cycle;

        compCache.set(id, Comp);
        return Comp;
    }

    function showBoardResizeHandle(w: BoardWheel): boolean {
        const entry = getWheelEntry(w.wheelType);
        return entry.ui !== 'compass' && entry.ui !== 'cycle';
    }

    // стабильный порядок на всякий — boardItems уже отсортирован, но лучше не надеяться
    $: globalLocId = $currentLocationId;
    function coord(v: unknown): number {
        return Number.isFinite(v) ? Number(v) : Number.MAX_SAFE_INTEGER;
    }

    $: items = ($boardItems ?? []).slice().sort((a, b) => {
        const ay = coord(a.layout?.y);
        const by = coord(b.layout?.y);
        if (ay !== by) return ay - by;

        const ax = coord(a.layout?.x);
        const bx = coord(b.layout?.x);
        if (ax !== bx) return ax - bx;

        return a.order - b.order;
    });

    $: savedTick = $savedLocations;
    $: itemsView = items.map((w) => {
        void savedTick;
        const obs = (w.observer as WheelObserverState) ?? { locationId: DEFAULT_LOCATION_ID, locked: false };
        const id = obs.locked ? obs.locationId : globalLocId;
        return { w, loc: resolveLocationById(id) };
    });
    $: itemsViewWithComp = itemsView.map((row) => ({
        ...row,
        Comp: pickComponentStable(row.w)
    }));
    $: phoneSlidesCount = itemsViewWithComp.length + ($isActiveProfileLocked ? 0 : 1);

    function updateViewportModes() {
        isDesktop = !!mqDesktop?.matches;
        isPhone = !!mqPhone?.matches;
    }

    function recomputePackedWidth() {
        packedWidth = packedEl?.clientWidth ?? 0;
    }

    function recomputePhoneViewportHeight() {
        if (!phoneSectionEl) {
            phoneViewportHeight = 0;
            return;
        }
        const rect = phoneSectionEl.getBoundingClientRect();
        const h = Math.max(0, Math.floor(window.innerHeight - rect.top));
        phoneViewportHeight = h;
    }

    function rowsFromHeight(px: number): number {
        const step = GRID_ROW_UNIT + GRID_ROW_GAP;
        return Math.max(1, Math.ceil((Math.max(0, px) + GRID_ROW_GAP) / step));
    }

    function scheduleHeightSync() {
        if (syncRaf) cancelAnimationFrame(syncRaf);
        syncRaf = requestAnimationFrame(syncHeightsToLayout);
    }

    function syncHeightsToLayout() {
        syncRaf = 0;
        if (!isDesktop) return;

        for (const row of itemsViewWithComp) {
            const el = cellEls.get(row.w.id);
            if (!el) continue;
            const content = el.firstElementChild as HTMLElement | null;
            const hPx = content?.offsetHeight ?? el.offsetHeight;
            const h = rowsFromHeight(hPx);
            const cur = itemRect(row.w).h;
            if (Math.abs(cur - h) >= 1) {
                boardApi.updateWheelById(row.w.id, { layout: { h } }, 'Board.syncLayoutHeight');
            }
        }

        if (pickerEl) {
            const content = pickerEl.firstElementChild as HTMLElement | null;
            const measured = content
                ? Math.max(content.offsetHeight, content.scrollHeight)
                : pickerEl.offsetHeight;
            pickerContentHeight = Math.max(measured, pickerEl.offsetHeight);
        }

    }

    function bindCellEl(id: string, el: HTMLElement | null) {
        if (el) {
            cellEls.set(id, el);
            scheduleHeightSync();
            return;
        }
        cellEls.delete(id);
    }

    onMount(() => {
        if ('matchMedia' in window) {
            mqDesktop = window.matchMedia('(min-width: 1025px)');
            mqPhone = window.matchMedia('(max-width: 640px)');
            updateViewportModes();
            onDesktopChange = () => updateViewportModes();
            onPhoneChange = () => updateViewportModes();
            if ('addEventListener' in mqDesktop) mqDesktop.addEventListener('change', onDesktopChange);
            else (mqDesktop as any).addListener(onDesktopChange);
            if (mqPhone) {
                if ('addEventListener' in mqPhone) mqPhone.addEventListener('change', onPhoneChange);
                else (mqPhone as any).addListener(onPhoneChange);
            }
        }

        if ('ResizeObserver' in window) {
            ro = new ResizeObserver(() => {
                recomputePackedWidth();
                scheduleHeightSync();
            });
            if (packedEl) ro.observe(packedEl);
        }

        queueMicrotask(recomputePackedWidth);
        queueMicrotask(scheduleHeightSync);
        queueMicrotask(recomputePhoneViewportHeight);
        window.addEventListener('resize', recomputePhoneViewportHeight, { passive: true });
    });

    onDestroy(() => {
        syncPhoneCarousel(false, 0, 0);
        window.removeEventListener('resize', recomputePhoneViewportHeight);
        if (syncRaf) cancelAnimationFrame(syncRaf);
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        if (layoutAnimTimer) {
            clearTimeout(layoutAnimTimer);
            layoutAnimTimer = 0;
        }
        finishResize();
        if (ro && packedEl) ro.unobserve(packedEl);
        if (ro && pickerEl) ro.unobserve(pickerEl);
        for (const [, el] of cellEls) {
            if (ro) ro.unobserve(el);
        }
        ro?.disconnect();
        if (mqDesktop && onDesktopChange) {
            if ('removeEventListener' in mqDesktop) mqDesktop.removeEventListener('change', onDesktopChange);
            else (mqDesktop as any).removeListener(onDesktopChange);
        }
        if (mqPhone && onPhoneChange) {
            if ('removeEventListener' in mqPhone) mqPhone.removeEventListener('change', onPhoneChange);
            else (mqPhone as any).removeListener(onPhoneChange);
        }
    });

    $: {
        const wheelCount = itemsViewWithComp.length;
        const hasPickerSlide = !$isActiveProfileLocked;
        const total = phoneSlidesCount;

        if (total <= 0) {
            phoneIndex = 0;
            phoneWheelId = null;
        } else if (phoneWheelId) {
            const exact = itemsViewWithComp.findIndex((row) => row.w.id === phoneWheelId);
            if (exact >= 0) phoneIndex = exact;
            else setPhoneIndex(phoneIndex);
        } else if (hasPickerSlide && phoneIndex === wheelCount) {
            phoneIndex = wheelCount;
        } else {
            setPhoneIndex(phoneIndex);
        }
    }

    $: unitPxRaw = packedWidth > 0
        ? (packedWidth - GRID_COL_GAP * (BOARD_GRID_COLUMNS - 1)) / BOARD_GRID_COLUMNS
        : 24;
    $: unitPx = Math.max(12, unitPxRaw);
    $: boardGridTemplateColumns = `repeat(${BOARD_GRID_COLUMNS}, minmax(0, 1fr))`;
    $: pickerRows = rowsFromHeight(pickerContentHeight);

    function itemRect(w: BoardWheel) {
        return normalizeRect(w.layout, BOARD_GRID_COLUMNS);
    }

    $: layoutMap = new Map(items.map((w) => [w.id, itemRect(w)]));
    $: pickerRect = nextFreeRect(layoutMap, { w: BOARD_DEFAULT_W, h: pickerRows }, BOARD_GRID_COLUMNS);

    function gridPlace(rect: { x: number; y: number; w: number; h: number }): string {
        const colStart = rect.x + 1;
        const rowStart = rect.y + 1;
        return `grid-column:${colStart} / span ${rect.w}; grid-row:${rowStart} / span ${rect.h};`;
    }

    function widthPxFromCols(w: number): number {
        return w * unitPx + (w - 1) * GRID_COL_GAP;
    }

    function colsFromWidthPx(px: number): number {
        const step = unitPx + GRID_COL_GAP;
        if (!(step > 0)) return 1;
        return Math.max(1, Math.round((px + GRID_COL_GAP) / step));
    }

    function dragStartWheel(id: string, e: DragEvent) {
        dragWheelId = id;
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.setData('text/plain', id);
        dt.effectAllowed = 'move';
    }

    function dragEndWheel() {
        dragWheelId = null;
    }

    function normalizePhoneIndex(next: number, count: number): number {
        if (count <= 0) return 0;
        const rem = next % count;
        return rem >= 0 ? rem : rem + count;
    }

    function setPhoneIndex(next: number) {
        const count = phoneSlidesCount;
        if (count <= 0) {
            phoneIndex = 0;
            phoneWheelId = null;
            return;
        }
        const normalized = normalizePhoneIndex(next, count);
        phoneIndex = normalized;
        phoneWheelId = itemsViewWithComp[normalized]?.w.id ?? null;
    }

    function goPhonePrev() {
        setPhoneIndex(phoneIndex - 1);
    }

    function goPhoneNext() {
        setPhoneIndex(phoneIndex + 1);
    }

    function resetPhoneSwipe() {
        phoneSwipeTracking = false;
    }

    function handlePhoneTouchStart(e: TouchEvent) {
        if (!isPhone) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const target = e.target;
        if (target instanceof Element) {
            const swipeZone = target.closest('[data-phone-swipe-zone="1"]');
            if (!swipeZone) {
                phoneSwipeTracking = false;
                return;
            }
        }
        phoneSwipeStartX = touch.clientX;
        phoneSwipeStartY = touch.clientY;
        phoneSwipeTracking = true;
    }

    function handlePhoneTouchEnd(e: TouchEvent) {
        if (!phoneSwipeTracking || !isPhone) {
            resetPhoneSwipe();
            return;
        }
        const touch = e.changedTouches[0];
        if (!touch) {
            resetPhoneSwipe();
            return;
        }
        const dx = touch.clientX - phoneSwipeStartX;
        const dy = touch.clientY - phoneSwipeStartY;
        resetPhoneSwipe();

        if (Math.abs(dx) < 50) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0) goPhoneNext();
        else goPhonePrev();
    }

    function finishResize() {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = 0;
        resizeState = null;
        resizeNextW = null;
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', handleResizeMove);
        window.removeEventListener('pointerup', handleResizeEnd);
        window.removeEventListener('pointercancel', handleResizeEnd);
    }

    function applyResizeTick() {
        resizeRaf = 0;
        if (!resizeState || resizeNextW == null) return;
        const nextW = resizeNextW;
        resizeNextW = null;
        boardApi.updateWheelById(resizeState.id, { layout: { w: nextW } }, 'Board.resizeWidth');
        scheduleHeightSync();
    }

    function handleResizeMove(e: PointerEvent) {
        if (!resizeState) return;
        const dx = e.clientX - resizeState.startX;
        const basePx = widthPxFromCols(resizeState.startW);
        const nextPx = Math.max(10, basePx + dx);
        const nextW = Math.min(BOARD_GRID_COLUMNS, colsFromWidthPx(nextPx));
        if (nextW === resizeState.startW && resizeNextW == null) return;
        resizeNextW = nextW;
        if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResizeTick);
    }

    function handleResizeEnd() {
        finishResize();
    }

    function startResize(id: string, e: PointerEvent) {
        if ($isActiveProfileLocked || !isDesktop) return;
        e.preventDefault();
        e.stopPropagation();
        const targetItem = items.find((x) => x.id === id);
        if (!targetItem) return;
        const rect = itemRect(targetItem);
        resizeState = { id, startX: e.clientX, startW: rect.w };
        document.body.style.cursor = 'ew-resize';
        window.addEventListener('pointermove', handleResizeMove);
        window.addEventListener('pointerup', handleResizeEnd);
        window.addEventListener('pointercancel', handleResizeEnd);
    }

    function triggerLayoutAnimation(ms = 260) {
        layoutAnimMs = Math.max(0, Math.trunc(ms));
        if (layoutAnimTimer) clearTimeout(layoutAnimTimer);
        layoutAnimTimer = window.setTimeout(() => {
            layoutAnimMs = 0;
            layoutAnimTimer = 0;
        }, layoutAnimMs + 40);
    }

    function dropToWheel(targetId: string, e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragWheelId || dragWheelId === targetId) return;
        boardApi.swapWheelLayoutById(dragWheelId, targetId, 'Board.dropToWheelSwap');
        triggerLayoutAnimation(260);
        dragWheelId = null;
        scheduleHeightSync();
    }

    function dropToGrid(e: DragEvent) {
        e.preventDefault();
        if (!dragWheelId || !packedEl) return;
        const rect = packedEl.getBoundingClientRect();
        const colStep = unitPx + GRID_COL_GAP;
        const rowStep = GRID_ROW_UNIT + GRID_ROW_GAP;
        const rx = Math.max(0, e.clientX - rect.left);
        const ry = Math.max(0, e.clientY - rect.top);
        const x = Math.floor(rx / colStep);
        const y = Math.floor(ry / rowStep);
        boardApi.moveWheelLayoutTo(dragWheelId, { x, y }, 'Board.dropToGrid');
        triggerLayoutAnimation(260);
        dragWheelId = null;
        scheduleHeightSync();
    }

    function observeCell(node: HTMLElement, id: string) {
        bindCellEl(id, node);
        const target = (node.firstElementChild as HTMLElement | null) ?? node;
        if (ro) ro.observe(target);
        return {
            destroy() {
                bindCellEl(id, null);
                if (ro) ro.unobserve(target);
            }
        };
    }

    function observePicker(node: HTMLElement) {
        pickerEl = node;
        if (ro) ro.observe(node);
        scheduleHeightSync();
        return {
            destroy() {
                if (ro) ro.unobserve(node);
                if (pickerEl === node) pickerEl = null;
            }
        };
    }

    $: {
        void isDesktop;
        void packedWidth;
        void itemsViewWithComp.length;
        if (isDesktop) queueMicrotask(scheduleHeightSync);
    }

    $: {
        const nav = $phoneCarouselState;
        if (!isPhone) {
            lastPhoneCommandSeq = nav.commandSeq;
        } else if (nav.commandSeq !== lastPhoneCommandSeq) {
            lastPhoneCommandSeq = nav.commandSeq;
            if (nav.commandStep < 0) goPhonePrev();
            else if (nav.commandStep > 0) goPhoneNext();
        }
    }

    $: syncPhoneCarousel(isPhone, phoneIndex, phoneSlidesCount);
    $: {
        void isPhone;
        void phoneIndex;
        void phoneSlidesCount;
        queueMicrotask(recomputePhoneViewportHeight);
    }
</script>

{#if isDesktop}
    <section
            class="packedGrid"
            bind:this={packedEl}
            role="presentation"
            style={`--col-gap:${GRID_COL_GAP}px; --row-gap:${GRID_ROW_GAP}px; --col-unit:${unitPx}px; --row-unit:${GRID_ROW_UNIT}px; grid-template-columns:${boardGridTemplateColumns};`}
            on:dragover|preventDefault
            on:drop={dropToGrid}
    >
        {#each itemsViewWithComp as row (row.w.id)}
            {@const rect = itemRect(row.w)}
            <div
                    class="cell packedCell"
                    use:observeCell={row.w.id}
                    role="presentation"
                    animate:flip={{ duration: layoutAnimMs }}
                    style={gridPlace(rect)}
            >
                <div
                        class="packedSurface"
                        role="presentation"
                        on:dragover|preventDefault
                        on:drop={(e) => dropToWheel(row.w.id, e)}
                >
                    <svelte:component
                            this={row.Comp}
                            wheel={row.w}
                            selectedTs={selectedTs}
                            location={row.loc}
                            dragEnabled={true}
                            onCardDragStart={(e: DragEvent) => dragStartWheel(row.w.id, e)}
                            onCardDragEnd={dragEndWheel}
                    />
                </div>
                {#if !$isActiveProfileLocked && showBoardResizeHandle(row.w)}
                    <button
                            class="resizeHandle"
                            type="button"
                            aria-label="Resize card"
                            title="Resize card"
                            on:pointerdown={(e) => startResize(row.w.id, e)}
                    ></button>
                {/if}
            </div>
        {/each}

        {#if !$isActiveProfileLocked}
            <div class="pickerCell" use:observePicker style={gridPlace(pickerRect)}>
                <WheelPicker/>
            </div>
        {/if}
    </section>
{:else if isPhone}
    <section
            class="phoneCarousel"
            bind:this={phoneSectionEl}
            aria-label="Wheel carousel"
            style={phoneViewportHeight > 0 ? `--phone-min-h:${phoneViewportHeight}px;` : ''}
            on:touchstart={handlePhoneTouchStart}
            on:touchend={handlePhoneTouchEnd}
            on:touchcancel={resetPhoneSwipe}
    >
        {#if phoneSlidesCount > 0}
            {#if !$isActiveProfileLocked && phoneIndex === itemsViewWithComp.length}
                <div class="phonePickerSlide">
                    <WheelPicker/>
                </div>
            {:else}
                {@const currentRow = itemsViewWithComp[phoneIndex]}
                {#if currentRow}
                    <div class="cell phoneCell">
                        <svelte:component
                                this={currentRow.Comp}
                                wheel={currentRow.w}
                                selectedTs={selectedTs}
                                location={currentRow.loc}
                                dragEnabled={false}
                                onCardDragStart={() => {}}
                                onCardDragEnd={() => {}}
                        />
                    </div>
                {/if}
            {/if}

        {/if}
    </section>
{:else}
    <section class="grid">
        {#each itemsViewWithComp as row (row.w.id)}
            <div class="cell" animate:flip={{ duration: 0 }}>
                <svelte:component
                        this={row.Comp}
                        wheel={row.w}
                        selectedTs={selectedTs}
                        location={row.loc}
                        dragEnabled={false}
                        onCardDragStart={() => {}}
                        onCardDragEnd={() => {}}
                />
            </div>
        {/each}
        {#if !$isActiveProfileLocked}
            <WheelPicker/>
        {/if}
    </section>
{/if}

<style>
    .packedGrid {
        display: grid;
        position: relative;
        z-index: 1;
        padding-top: var(--sp-12);
        column-gap: var(--col-gap);
        row-gap: var(--row-gap);
        grid-auto-rows: var(--row-unit);
        align-items: start;
    }
    .packedCell {
        position: relative;
        min-width: 0;
        pointer-events: none;
    }
    .packedSurface {
        pointer-events: auto;
        position: relative;
    }
    .resizeHandle {
        position: absolute;
        right: 8px;
        bottom: 8px;
        width: 12px;
        height: 12px;
        border-radius: var(--radius-3);
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--fg), transparent 80%);
        cursor: ew-resize;
        padding: 0;
        pointer-events: auto;
        touch-action: none;
    }
    .resizeHandle:hover {
        background: color-mix(in oklab, var(--fg), transparent 70%);
    }
    .packedSurface > :global(*:not(.resizeHandle)) {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
    }
    .pickerCell {
        min-width: 0;
    }
    .pickerCell > :global(*) {
        width: 100%;
        box-sizing: border-box;
    }
    .phoneCarousel {
        display: grid;
        gap: var(--sp-10);
        padding-top: var(--sp-8);
        min-height: var(--phone-min-h, auto);
        align-content: start;
        min-width: 0;
    }
    .phoneCell {
        width: 100%;
        min-width: 0;
        min-height: var(--phone-min-h, auto);
    }
    .phoneCell > :global(*) {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        display: block;
        min-height: 100%;
    }
    .phonePickerSlide {
        min-width: 0;
        min-height: var(--phone-min-h, auto);
    }
    .phonePickerSlide > :global(*) {
        width: 100%;
        box-sizing: border-box;
        min-height: 100%;
    }
    @media (max-width: 640px) {
        .phoneCarousel {
            height: 100%;
            min-height: 0;
            padding-top: 0;
            gap: 0;
            align-content: stretch;
            overflow: hidden;
        }
        .phoneCell,
        .phonePickerSlide {
            height: 100%;
            min-height: 0;
        }
        .phoneCell > :global(*),
        .phonePickerSlide > :global(*) {
            height: 100%;
            min-height: 0;
        }
    }
    .grid {
        display: grid;
        gap: var(--sp-13);
        grid-template-columns: 1fr;
        align-items: start;
    }
    .grid > .cell {
        display: block;
        width: 100%;
    }

    .grid > .cell > :global(*) {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        display: block;
    }

    @media (min-width: 760px) {
        .grid { grid-template-columns: 1fr 1fr; }
    }
    @media (min-width: 1024px) {
        .grid { grid-template-columns: 1fr 1fr 1fr; }
    }
</style>
