<script lang="ts">
    import { objectLabel, type ObjId } from '../lib/catalog';
    import type { ConstellationTargetGroup } from '../lib/catalog/constellationGroups';

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
    export let showAllStarsOption = false;
    export let allStarsChecked = false;
    export let allStarsLabel = 'All Stars';
    export let groupOptions: ConstellationTargetGroup[] = [];
    export let maxHeight = 'none';
    export let search = '';
    export let onToggleItem: (id: ObjId) => void = () => {};
    export let onToggleAll: () => void = () => {};
    export let onToggleAllStars: () => void = () => {};
    export let onToggleGroup: (groupId: ConstellationTargetGroup['id']) => void = () => {};

    type GroupSection = {
        group: ConstellationTargetGroup;
        itemIds: ObjId[];
    };

    function toggleItemById(id: ObjId) {
        if (locked) return;
        onToggleItem(id);
    }

    function toggleAllItems() {
        if (locked) return;
        onToggleAll();
    }

    function toggleGroupById(groupId: ConstellationTargetGroup['id']) {
        if (locked) return;
        onToggleGroup(groupId);
    }

    function toggleAllStarsItems() {
        if (locked) return;
        onToggleAllStars();
    }

    function filteredChecklist(
        list: ObjId[],
        groups: ConstellationTargetGroup[],
        queryRaw: string
    ): { items: ObjId[]; sections: GroupSection[]; looseItems: ObjId[] } {
        const listSet = new Set(list);
        const normalizedGroups = groups
            .map((group) => ({
                ...group,
                itemIds: group.itemIds.filter((id) => listSet.has(id))
            }))
            .filter((group) => group.itemIds.length > 0);

        const groupedIds = new Set(normalizedGroups.flatMap((group) => group.itemIds));
        const looseItemsBase = list
            .filter((id) => !groupedIds.has(id))
            .slice()
            .sort((a, b) => objectLabel(a).localeCompare(objectLabel(b)));
        const query = queryRaw.trim().toLowerCase();
        if (!query) {
            return {
                items: list,
                sections: normalizedGroups.map((group) => ({ group, itemIds: group.itemIds })),
                looseItems: looseItemsBase
            };
        }

        const matchedGroups = normalizedGroups.filter((group) => {
            const haystack = `${group.label} ${group.id}`.toLowerCase();
            return haystack.includes(query);
        });
        const forceVisibleByGroup = new Set(matchedGroups.flatMap((group) => group.itemIds));
        const starMatches = new Set(
            list.filter((id) => objectLabel(id).toLowerCase().includes(query))
        );
        const visibleStarIds = new Set([...forceVisibleByGroup, ...starMatches]);

        const sections = normalizedGroups.flatMap((group) => {
            const groupMatched = matchedGroups.some((matched) => matched.id === group.id);
            const itemIds = group.itemIds.filter((id) => visibleStarIds.has(id));
            if (!groupMatched && itemIds.length === 0) return [];
            return [{ group, itemIds }];
        });

        const looseItems = looseItemsBase.filter((id) => visibleStarIds.has(id));
        const items = list.filter((id) => visibleStarIds.has(id));

        return { items, sections, looseItems };
    }

    function isGroupChecked(group: ConstellationTargetGroup, selected: Set<ObjId>): boolean {
        return group.itemIds.length > 0 && group.itemIds.every((id) => selected.has(id));
    }

    $: selectedSet = new Set(selectedValues);
    $: filteredChecklistState = filteredChecklist(items, groupOptions, search);
    $: visibleItems = filteredChecklistState.items;
    $: visibleSections = filteredChecklistState.sections;
    $: visibleLooseItems = filteredChecklistState.looseItems;
    $: groupedMode = groupOptions.length > 0;
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
        {#if groupedMode}
            {#each visibleLooseItems as id (id)}
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
            {#if showAllStarsOption && visibleSections.length > 0}
                <button
                    type="button"
                    class="checkItem checkItemAll"
                    class:readonly={locked}
                    disabled={locked}
                    on:click={toggleAllStarsItems}
                    aria-pressed={allStarsChecked}
                >
                    <span class="checkBox" aria-hidden="true"></span>
                    <span class="checkText">{allStarsLabel}</span>
                </button>
            {/if}
            {#each visibleSections as section (section.group.id)}
                {@const checked = isGroupChecked(section.group, selectedSet)}
                <button
                    type="button"
                    class="checkItem checkItemAll"
                    class:readonly={locked}
                    disabled={locked}
                    on:click={() => toggleGroupById(section.group.id)}
                    aria-pressed={checked}
                >
                    <span class="checkBox" aria-hidden="true"></span>
                    <span class="checkText">{section.group.label}</span>
                </button>
                {#each section.itemIds as id (id)}
                    {@const itemChecked = selectedSet.has(id)}
                    <button
                        type="button"
                        class="checkItem"
                        class:readonly={locked}
                        disabled={locked}
                        on:click={() => toggleItemById(id)}
                        aria-pressed={itemChecked}
                    >
                        <span class="checkBox" aria-hidden="true"></span>
                        <span class="checkText">{objectLabel(id)}</span>
                    </button>
                {/each}
            {/each}
        {:else}
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
        {/if}
    </div>
</div>

<style>
    .checksWrap {
        display: grid;
        gap: var(--sp-8);
        min-width: 0;
    }

    .roleSearch {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border-radius: var(--radius-10);
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        color: inherit;
        padding: var(--sp-9) var(--sp-11);
        font: inherit;
    }

    .checks {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--sp-8);
        border-radius: var(--radius-12);
        border: 1px solid var(--btn-border);
        background: color-mix(in oklab, var(--btn-bg), transparent 10%);
        padding: var(--sp-10);
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
        gap: var(--sp-8);
        padding: var(--sp-8) var(--sp-10);
        border-radius: var(--radius-10);
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
        border-radius: var(--radius-5);
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
        font-size: var(--fs-13);
        font-weight: 700;
        line-height: 1.2;
    }
</style>
