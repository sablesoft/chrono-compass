<script lang="ts">
    type WheelInfoChip = {
        id: string;
        text: string;
        label?: string;
        value?: string;
        kind?: string;
        clickable?: boolean;
        disabled?: boolean;
        title?: string;
        ariaLabel?: string;
        dim?: boolean;
    };

    export let chips: WheelInfoChip[] = [];
    export let onChipClick: (id: string) => void = () => {};
    export let onReorder: (ids: string[]) => void = () => {};
    export let reorderEnabled = true;
    let dragChipId: string | null = null;

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
        const ids = chips.map((x) => x.id);
        const next = reorderIds(ids, dragChipId, targetId);
        dragChipId = null;
        onReorder(next);
    }
</script>

<div class="infoBlock">
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

    <slot />
</div>

<style>
    .infoBlock {
        width: 100%;
        max-width: 100%;
        display: grid;
        gap: 6px;
        margin-top: auto;
        min-height: 0;
        overflow: auto;
    }

    .chipGrid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 4px 2px;
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
</style>
