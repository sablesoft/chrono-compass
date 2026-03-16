<script lang="ts">
    import { objectLabel, type ObjId } from '../lib/catalog';

    export let roleLabel = '';
    export let searchId = '';
    export let groupLabelId = '';
    export let searchPlaceholder = '';
    export let items: ObjId[] = [];
    export let selectedValues: ObjId[] = [];
    export let locked = false;
    export let showAllOption = false;
    export let allChecked = false;
    export let allLabel = 'All';
    export let maxHeight = 'none';
    export let search = '';
    export let onToggleItem: (id: ObjId) => void = () => {};
    export let onToggleAll: () => void = () => {};

    function toggleItemById(id: ObjId) {
        if (locked) return;
        onToggleItem(id);
    }

    function toggleAllItems() {
        if (locked) return;
        onToggleAll();
    }

    function filteredItems(list: ObjId[], queryRaw: string): ObjId[] {
        const query = queryRaw.trim().toLowerCase();
        if (!query) return list;
        return list.filter((id) => objectLabel(id).toLowerCase().includes(query));
    }

    $: visibleItems = filteredItems(items, search);
    $: selectedSet = new Set(selectedValues);
</script>

<div class="checksWrap" role="group" aria-labelledby={groupLabelId}>
    <input
        id={searchId}
        class="roleSearch"
        type="search"
        placeholder={searchPlaceholder || `Search ${roleLabel}`}
        bind:value={search}
    />
    <div class="checks checksScrollable" style={`--rc-max-height:${maxHeight}`}>
        {#if showAllOption}
            <button
                type="button"
                class="checkItem checkItemAll"
                class:readonly={locked}
                disabled={locked}
                on:click={toggleAllItems}
                aria-pressed={allChecked}
            >
                <span class="checkBox" aria-hidden="true"></span>
                <span class="checkText">{allLabel}</span>
            </button>
        {/if}
        {#each visibleItems as id (id)}
            {@const checked = selectedSet.has(id)}
            <button
                type="button"
                class="checkItem"
                class:readonly={locked}
                disabled={locked}
                on:click={() => toggleItemById(id)}
                aria-pressed={checked}
            >
                <span class="checkBox" aria-hidden="true"></span>
                <span class="checkText">{objectLabel(id)}</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .checksWrap {
        display: grid;
        gap: 8px;
        min-width: 0;
    }

    .roleSearch {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        padding: 9px 11px;
        font: inherit;
    }

    .checks {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        border-radius: 12px;
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        padding: 10px;
    }

    .checksScrollable {
        max-height: var(--rc-max-height);
        overflow-y: auto;
        align-content: start;
    }

    .checkItem {
        position: relative;
        display: grid;
        grid-template-columns: 16px 1fr;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid color-mix(in oklab, var(--btn-border), transparent 25%);
        background: color-mix(in oklab, var(--btn-bg), transparent 18%);
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
        color: inherit;
        text-align: left;
        width: 100%;
    }

    .checkItem:hover {
        background: color-mix(in oklab, var(--btn-bg), var(--fg) 8%);
        border-color: color-mix(in oklab, var(--btn-border), var(--fg) 18%);
        transform: translateY(-1px);
    }

    .checkItem.readonly {
        cursor: default;
    }

    .checkItem[aria-pressed='true'] {
        border-color: color-mix(in oklab, var(--accent-live), transparent 35%);
        background: color-mix(in oklab, var(--accent-live), transparent 88%);
    }

    .checkItemAll {
        border-color: color-mix(in oklab, var(--accent-gold), transparent 48%);
        background: color-mix(in oklab, var(--accent-gold), transparent 93%);
    }

    .checkItemAll:hover {
        background: color-mix(in oklab, var(--accent-gold), transparent 89%);
        border-color: color-mix(in oklab, var(--accent-gold), transparent 34%);
    }

    .checkItemAll[aria-pressed='true'] {
        border-color: color-mix(in oklab, var(--accent-gold), transparent 28%);
        background: color-mix(in oklab, var(--accent-gold), transparent 82%);
    }

    .checkBox {
        width: 16px;
        height: 16px;
        border-radius: 5px;
        border: 1px solid color-mix(in oklab, var(--btn-border), var(--fg) 15%);
        background: color-mix(in oklab, var(--bg), white 6%);
        box-sizing: border-box;
        display: inline-block;
        position: relative;
    }

    .checkItem[aria-pressed='true'] .checkBox {
        border-color: color-mix(in oklab, var(--accent-live), transparent 20%);
        background: color-mix(in oklab, var(--accent-live), transparent 35%);
    }

    .checkItem[aria-pressed='true'] .checkBox::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 5px;
        height: 9px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(40deg);
    }

    .checkText {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
    }
</style>
