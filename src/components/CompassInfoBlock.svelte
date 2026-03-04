<script lang="ts">
    type WheelInfoChip = {
        id: string;
        text?: string;
        label?: string;
        value?: string;
        kind?: string;
        group?: 'moment' | 'cycle';
        clickable?: boolean;
        disabled?: boolean;
        title?: string;
        ariaLabel?: string;
        dim?: boolean;
    };

    type WheelInfoConfigRow = {
        id: string;
        systemLabel: string;
        value: string;
        selected: boolean;
        userLabel?: string;
        isDefault?: boolean;
    };

    export let chips: WheelInfoChip[] = [];
    export let momentChips: WheelInfoChip[] | null = null;
    export let cycleChips: WheelInfoChip[] | null = null;
    export let allChips: WheelInfoConfigRow[] = [];
    export let onChipClick: (id: string) => void = () => {};
    export let onReorder: (ids: string[]) => void = () => {};
    export let onConfigure: (next: { selectedIds: string[]; labels: Record<string, string> }) => void = () => {};
    export let reorderEnabled = true;

    let dragChipId: string | null = null;
    let showEditButton = false;
    let showEditor = false;
    let touchMode = false;

    let draftSelected = new Set<string>();
    let draftLabels: Record<string, string> = {};

    function resolveChipParts(chip: WheelInfoChip): { label: string; value: string } {
        if (chip.label && chip.value) return { label: chip.label, value: chip.value };
        const raw = String(chip.text ?? '').trim();
        const parts = raw.split('•').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return {
                label: parts[0] ?? 'Info',
                value: parts.slice(1).join(' • ')
            };
        }
        return {
            label: raw || 'Info',
            value: '—'
        };
    }

    function chipLabel(chip: WheelInfoChip): string {
        return resolveChipParts(chip).label;
    }

    function chipValue(chip: WheelInfoChip): string {
        return resolveChipParts(chip).value;
    }

    function reorderIds(list: string[], fromId: string, toId: string): string[] {
        const from = list.indexOf(fromId);
        const to = list.indexOf(toId);
        if (from < 0 || to < 0 || from === to) return list;
        const next = list.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
    }

    function handleDragStart(e: DragEvent, id: string) {
        if (!reorderEnabled) return;
        dragChipId = id;
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.effectAllowed = 'move';
        dt.setData('text/plain', id);
    }

    function handleDragEnd() {
        dragChipId = null;
    }

    function handleDrop(e: DragEvent, targetId: string) {
        e.preventDefault();
        if (!reorderEnabled || !dragChipId || dragChipId === targetId) {
            dragChipId = null;
            return;
        }
        const from = chips.find((x) => x.id === dragChipId);
        const to = chips.find((x) => x.id === targetId);
        if (from?.group && to?.group && from.group !== to.group) {
            dragChipId = null;
            return;
        }
        const ids = chips.map((x) => x.id);
        const next = reorderIds(ids, dragChipId, targetId);
        dragChipId = null;
        onReorder(next);
    }

    function ensureTouchMode() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            touchMode = false;
            return;
        }
        touchMode = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    }

    function onBlockEnter() {
        if (!touchMode) showEditButton = true;
    }

    function onBlockLeave() {
        if (!touchMode) showEditButton = false;
    }

    function onBlockClick() {
        if (touchMode) showEditButton = !showEditButton;
    }

    function onBlockKeydown(e: KeyboardEvent) {
        if (!touchMode) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showEditButton = !showEditButton;
        }
    }

    function openEditor() {
        draftSelected = new Set(allChips.filter((r) => r.selected).map((r) => r.id));
        draftLabels = {};
        for (const row of allChips) {
            const value = String(row.userLabel ?? '').trim();
            if (value) draftLabels[row.id] = value;
        }
        showEditor = true;
    }

    function closeEditor() {
        showEditor = false;
    }

    function toggleSelected(id: string) {
        if (draftSelected.has(id)) draftSelected.delete(id);
        else draftSelected.add(id);
        draftSelected = new Set(draftSelected);
    }

    function updateDraftLabel(id: string, e: Event) {
        const target = e.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        draftLabels = { ...draftLabels, [id]: target.value };
    }

    function applyEditor() {
        const selectedIds = allChips
            .map((r) => r.id)
            .filter((id) => draftSelected.has(id));

        const labels: Record<string, string> = {};
        for (const row of allChips) {
            const value = String(draftLabels[row.id] ?? '').trim();
            if (!value) continue;
            labels[row.id] = value;
        }

        onConfigure({ selectedIds, labels });
        showEditor = false;
    }

    function resetToDefaults() {
        const defaultIds = allChips
            .filter((row) => row.isDefault)
            .map((row) => row.id);

        const selectedIds = defaultIds.length > 0
            ? defaultIds
            : allChips.map((row) => row.id);

        onConfigure({ selectedIds, labels: {} });
        showEditor = false;
    }

    $: ensureTouchMode();
</script>

<div
        class="infoBlock"
        role="button"
        aria-label="Info chips block"
        tabindex="0"
        on:mouseenter={onBlockEnter}
        on:mouseleave={onBlockLeave}
        on:click={onBlockClick}
        on:keydown={onBlockKeydown}
>
    {#if showEditButton}
        <button
                type="button"
                class="editBtn navBtn"
                title="Edit info chips"
                aria-label="Edit info chips"
                on:click|stopPropagation={openEditor}
        >✎</button>
    {/if}

    {#if momentChips || cycleChips}
        {#if momentChips && momentChips.length}
            <div class="chipGrid">
                {#each momentChips as chip (chip.id)}
                    <div
                            class="chipWrap"
                            class:dragging={dragChipId === chip.id}
                            draggable={reorderEnabled}
                            role="listitem"
                            on:dragstart={(e) => handleDragStart(e, chip.id)}
                            on:dragend={handleDragEnd}
                            on:dragover|preventDefault
                            on:drop={(e) => handleDrop(e, chip.id)}
                    >
                        {#if chip.clickable}
                            <button
                                    type="button"
                                    class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                                    class:dim={chip.dim}
                                    class:disabledTag={chip.disabled}
                                    title={chip.title}
                                    aria-label={chip.ariaLabel}
                                    disabled={chip.disabled}
                                    on:click={() => onChipClick(chip.id)}
                            >
                                <span class="chipTwoRows">
                                    <span class="chipLabel">{chipLabel(chip)}</span>
                                    <span class="chipDivider" aria-hidden="true"></span>
                                    <span class="chipValue">{chipValue(chip)}</span>
                                </span>
                            </button>
                        {:else}
                            <span
                                    class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`}
                                    class:dim={chip.dim}
                                    title={chip.title}
                                    aria-label={chip.ariaLabel}
                            >
                                <span class="chipTwoRows">
                                    <span class="chipLabel">{chipLabel(chip)}</span>
                                    <span class="chipDivider" aria-hidden="true"></span>
                                    <span class="chipValue">{chipValue(chip)}</span>
                                </span>
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        {#if momentChips && momentChips.length && cycleChips && cycleChips.length}
            <div class="chipSep" aria-hidden="true"></div>
        {/if}

        {#if cycleChips && cycleChips.length}
            <div class="chipGrid">
                {#each cycleChips as chip (chip.id)}
                    <div
                            class="chipWrap"
                            class:dragging={dragChipId === chip.id}
                            draggable={reorderEnabled}
                            role="listitem"
                            on:dragstart={(e) => handleDragStart(e, chip.id)}
                            on:dragend={handleDragEnd}
                            on:dragover|preventDefault
                            on:drop={(e) => handleDrop(e, chip.id)}
                    >
                        {#if chip.clickable}
                            <button
                                    type="button"
                                    class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                                    class:dim={chip.dim}
                                    class:disabledTag={chip.disabled}
                                    title={chip.title}
                                    aria-label={chip.ariaLabel}
                                    disabled={chip.disabled}
                                    on:click={() => onChipClick(chip.id)}
                            >
                                <span class="chipTwoRows">
                                    <span class="chipLabel">{chipLabel(chip)}</span>
                                    <span class="chipDivider" aria-hidden="true"></span>
                                    <span class="chipValue">{chipValue(chip)}</span>
                                </span>
                            </button>
                        {:else}
                            <span
                                    class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`}
                                    class:dim={chip.dim}
                                    title={chip.title}
                                    aria-label={chip.ariaLabel}
                            >
                                <span class="chipTwoRows">
                                    <span class="chipLabel">{chipLabel(chip)}</span>
                                    <span class="chipDivider" aria-hidden="true"></span>
                                    <span class="chipValue">{chipValue(chip)}</span>
                                </span>
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {:else}
        <div class="chipGrid">
        {#each chips as chip (chip.id)}
            <div
                    class="chipWrap"
                    class:dragging={dragChipId === chip.id}
                    draggable={reorderEnabled}
                    role="listitem"
                on:dragstart={(e) => handleDragStart(e, chip.id)}
                on:dragend={handleDragEnd}
                on:dragover|preventDefault
                on:drop={(e) => handleDrop(e, chip.id)}
        >
            {#if chip.clickable}
                <button
                        type="button"
                        class={`ui-tag chip-${chip.kind ?? 'default'} chipButton`}
                        class:dim={chip.dim}
                        class:disabledTag={chip.disabled}
                        title={chip.title}
                        aria-label={chip.ariaLabel}
                        disabled={chip.disabled}
                        on:click={() => onChipClick(chip.id)}
                >
                    <span class="chipTwoRows">
                        <span class="chipLabel">{chipLabel(chip)}</span>
                        <span class="chipDivider" aria-hidden="true"></span>
                        <span class="chipValue">{chipValue(chip)}</span>
                    </span>
                </button>
            {:else}
                <span
                        class={`ui-tag chip-${chip.kind ?? 'default'} chipStatic`}
                        class:dim={chip.dim}
                        title={chip.title}
                        aria-label={chip.ariaLabel}
                >
                    <span class="chipTwoRows">
                        <span class="chipLabel">{chipLabel(chip)}</span>
                        <span class="chipDivider" aria-hidden="true"></span>
                        <span class="chipValue">{chipValue(chip)}</span>
                    </span>
                    </span>
                {/if}
            </div>
        {/each}
        </div>
    {/if}

    <slot />
</div>

{#if showEditor}
    <div class="editorOverlay" role="button" tabindex="0" aria-label="Close chip editor" on:click={closeEditor} on:keydown={(e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeEditor();
        }
    }}>
        <div
                class="editorModal"
                role="dialog"
                tabindex="-1"
                aria-modal="true"
                aria-label="Wheel info chips"
                on:click|stopPropagation
                on:keydown|stopPropagation
        >
            <header class="editorHead">
                <div class="editorTitle">Info chips</div>
                <button type="button" class="navBtn" on:click={closeEditor}>×</button>
            </header>

            <div class="editorList">
                {#if allChips.length === 0}
                    <div class="editorEmpty">No info rows available for this wheel.</div>
                {/if}
                {#each allChips as row (row.id)}
                    <div class="editorRow">
                        <div class="col sys" title={row.systemLabel}>
                            {row.systemLabel}
                            {#if row.isDefault}
                                <span class="defMark">default</span>
                            {/if}
                        </div>
                        <input
                                class="col user"
                                type="text"
                                placeholder="Custom label"
                                value={draftLabels[row.id] ?? ''}
                                on:input={(e) => updateDraftLabel(row.id, e)}
                        />
                        <div class="col val" title={row.value}>{row.value}</div>
                        <label class="col pick">
                            <input
                                    type="checkbox"
                                    checked={draftSelected.has(row.id)}
                                    on:change={() => toggleSelected(row.id)}
                            />
                            <span>{draftSelected.has(row.id) ? 'Selected' : 'Hidden'}</span>
                        </label>
                    </div>
                {/each}
            </div>

            <footer class="editorFoot">
                <button type="button" class="navBtn" on:click={resetToDefaults}>Reset</button>
                <button type="button" class="navBtn" on:click={closeEditor}>Cancel</button>
                <button type="button" class="navBtn" on:click={applyEditor}>Apply</button>
            </footer>
        </div>
    </div>
{/if}

<style>
    .infoBlock {
        width: 100%;
        max-width: 100%;
        display: grid;
        gap: 6px;
        margin-top: auto;
        min-height: 0;
        overflow: auto;
        position: relative;
    }

    .editBtn {
        position: absolute;
        bottom: 2px;
        right: 2px;
        z-index: 3;
        height: 28px;
        min-width: 34px;
        padding: 0 8px;
    }

    .chipGrid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 4px 2px;
    }

    .chipSep {
        height: 1px;
        width: 100%;
        margin: 2px 0 6px;
        background: color-mix(in oklab, var(--fg), transparent 88%);
    }

    .chipWrap {
        display: inline-flex;
        align-items: stretch;
        cursor: grab;
    }

    .chipWrap.dragging {
        opacity: 0.55;
    }

    .chipButton {
        cursor: pointer;
        text-align: left;
        border-color: color-mix(in oklab, var(--accent-blue), transparent 70%);
        background: color-mix(in oklab, var(--accent-blue), transparent 91%);
    }

    .chipButton:hover:not(:disabled) {
        background: color-mix(in oklab, var(--accent-blue), transparent 86%);
        border-color: color-mix(in oklab, var(--accent-blue), transparent 58%);
    }

    .chipStatic {
        border-color: color-mix(in oklab, var(--fg), transparent 84%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }

    .chip-moment {
        border-color: color-mix(in oklab, var(--accent-live), transparent 70%);
        background: color-mix(in oklab, var(--accent-live), transparent 88%);
    }

    .disabledTag {
        opacity: 0.55;
        cursor: default;
    }

    .dim {
        opacity: 0.72;
    }

    .ui-tag {
        font-variant-numeric: tabular-nums;
        font-size: 12px;
        padding: 5px 10px;
    }

    .chip-muted {
        opacity: 0.7;
    }

    .chip-ok {
        color: color-mix(in oklab, var(--fg), white 4%);
    }

    .chip-bad {
        opacity: 0.82;
    }

    .chip-accent {
        font-weight: 800;
    }

    .chipTwoRows {
        display: grid;
        font-size: 16px;
        grid-template-rows: auto auto auto;
        gap: 3px;
    }

    .chipLabel {
        display: block;
        opacity: 0.8;
        font-weight: 700;
    }

    .chipDivider {
        display: block;
        height: 1px;
        margin: 1px 2px;
        background: color-mix(in oklab, var(--fg), transparent 84%);
    }

    .chipValue {
        display: block;
        font-weight: 800;
        opacity: 0.96;
    }

    .editorOverlay {
        position: fixed;
        inset: 0;
        z-index: 120;
        background: rgba(0, 0, 0, 0.5);
        display: grid;
        place-items: center;
        padding: 12px;
    }

    .editorModal {
        width: min(860px, 96vw);
        max-height: min(82vh, 880px);
        overflow: auto;
        border-radius: 14px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
        background: color-mix(in oklab, var(--panel), black 6%);
        box-shadow: 0 16px 56px rgba(0, 0, 0, 0.4);
        display: grid;
        gap: 10px;
        padding: 10px;
    }

    .editorHead,
    .editorFoot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .editorTitle {
        font-size: 14px;
        font-weight: 800;
    }

    .editorList {
        display: grid;
        gap: 8px;
    }
    .editorEmpty {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
        opacity: 0.8;
        font-size: 12px;
    }

    .editorRow {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.1fr) auto;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: color-mix(in oklab, var(--fg), transparent 95%);
    }

    .col {
        min-width: 0;
        font-size: 12px;
    }

    .col.sys,
    .col.val {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-variant-numeric: tabular-nums;
    }
    .defMark {
        margin-left: 6px;
        font-size: 10px;
        opacity: 0.65;
    }

    .col.user {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border-radius: 8px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 8%);
        color: inherit;
        padding: 6px 8px;
    }

    .col.pick {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }

    @media (max-width: 760px) {
        .editorRow {
            grid-template-columns: 1fr;
            gap: 6px;
        }
    }
</style>
