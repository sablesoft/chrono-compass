<script lang="ts">
    import type { ObjId } from '../lib/catalog';
    import type { SavedWheel } from '../lib/profile/types';
    import { activeProfile } from '../lib/profile/store';
    import { catalogWheelsForPair, savedWheelsForPair } from '../lib/wheel/ui/relatedWheels';

    export let objId: ObjId;
    export let pinnedId: ObjId | null = null;
    export let onPickWheel: (input: {
        wheelType: SavedWheel['type'];
        title: string;
        roles: SavedWheel['roles'];
        observer?: SavedWheel['observer'];
        time?: SavedWheel['time'];
    }) => void = () => {};

    let open = false;

    $: savedAll = (($activeProfile?.data?.wheels ?? []) as SavedWheel[]);
    $: savedRows = savedWheelsForPair(savedAll, objId, pinnedId);
    $: catalogRows = catalogWheelsForPair(objId, pinnedId);
    $: hasAny = savedRows.length > 0 || catalogRows.length > 0;

    function toggleOpen() {
        open = !open;
    }

    function emitWheel(input: {
        wheelType: SavedWheel['type'];
        title: string;
        roles: SavedWheel['roles'];
        observer?: SavedWheel['observer'];
        time?: SavedWheel['time'];
    }) {
        onPickWheel(input);
    }

    function onPickSaved(w: SavedWheel) {
        emitWheel({
            wheelType: w.type,
            title: w.title,
            roles: w.roles,
            observer: w.observer,
            time: w.time
        });
    }

    function onPickCatalog(x: { wheelType: SavedWheel['type']; title: string; roles: SavedWheel['roles'] }) {
        emitWheel({
            wheelType: x.wheelType,
            title: x.title,
            roles: x.roles
        });
    }
</script>

<button
        type="button"
        class="rwBtn"
        class:active={open}
        aria-expanded={open}
        title="Show related wheels"
        on:click={toggleOpen}
>⎈</button>

{#if open}
    <div class="rwPanel">
        {#if !hasAny}
            <div class="rwEmpty">No related wheels.</div>
        {:else}
            <div class="rwBlock">
                <div class="rwTitle">Saved</div>
                {#if savedRows.length === 0}
                    <div class="rwEmpty">No saved wheels for this pair.</div>
                {:else}
                    {#each savedRows as w (w.dedupKey)}
                        <button type="button" class="rwItem" on:click={() => onPickSaved(w)}>
                            {w.title}
                        </button>
                    {/each}
                {/if}
            </div>

            <div class="rwBlock">
                <div class="rwTitle">Catalog</div>
                {#if catalogRows.length === 0}
                    <div class="rwEmpty">No catalog configs for this pair.</div>
                {:else}
                    {#each catalogRows as w (w.key)}
                        <button type="button" class="rwItem" on:click={() => onPickCatalog(w)}>
                            {w.title}
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .rwBtn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
        background: transparent;
        color: var(--fg);
        font-size: 13px;
        line-height: 1;
        cursor: pointer;
        z-index: 2;
    }

    .rwBtn.active {
        border-color: color-mix(in oklab, var(--accent-live), transparent 55%);
        background: color-mix(in oklab, var(--accent-live), transparent 92%);
    }

    .rwPanel {
        margin-top: 6px;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 86%);
        border-radius: 10px;
        background: color-mix(in oklab, var(--fg), transparent 97%);
        padding: 8px;
        display: grid;
        gap: 8px;
        margin-top: 4px;
        width: 100%;
    }

    .rwBlock {
        display: grid;
        gap: 6px;
    }

    .rwTitle {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
    }

    .rwItem {
        width: 100%;
        text-align: left;
        border: 1px solid color-mix(in oklab, var(--fg), transparent 88%);
        background: transparent;
        color: var(--fg);
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 12px;
        cursor: pointer;
    }

    .rwItem:hover {
        border-color: color-mix(in oklab, var(--fg), transparent 80%);
        background: color-mix(in oklab, var(--fg), transparent 94%);
    }

    .rwEmpty {
        font-size: 11px;
        opacity: 0.75;
        padding: 2px 2px;
    }
</style>
