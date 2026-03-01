<!--src/component/Board.svelte -->
<script lang="ts">
    import { boardItems } from '../lib/board/store';
    import { flip } from 'svelte/animate';
    import { currentLocationId, resolveLocationById } from '../lib/location/store';
    import { getWheelEntry } from '../lib/board/registry';

    import WheelPicker from "./WheelPicker.svelte";
    import Compass from './Compass.svelte';
    import Cycle from './Cycle.svelte';

    import type {WheelObserverState} from "../lib/wheel/types";
    import type {BoardWheel} from "../lib/board/types";
    import {DEFAULT_LOCATION_ID} from "../lib/location/types";
    export let selectedTs: number;

    const compCache = new Map<string, any>();

    function pickComponentStable(w: BoardWheel) {
        const id = w.id;
        const cached = compCache.get(id);
        if (cached) return cached;

        const entry = getWheelEntry(w.wheelType);
        const Comp = entry.ui === 'compass' ? Compass : Cycle;

        compCache.set(id, Comp);
        return Comp;
    }

    // стабильный порядок на всякий — boardItems уже отсортирован, но лучше не надеяться
    $: globalLocId = $currentLocationId;
    $: items = ($boardItems ?? []).slice().sort((a, b) => a.order - b.order);

    $: itemsView = items.map((w) => {
        const obs = (w.observer as WheelObserverState) ?? { locationId: DEFAULT_LOCATION_ID, locked: false };
        const id = obs.locked ? obs.locationId : globalLocId;
        return { w, loc: resolveLocationById(id) };
    });
    $: itemsViewWithComp = itemsView.map((row) => ({
        ...row,
        Comp: pickComponentStable(row.w)
    }));
</script>

<section class="grid">
    {#each itemsViewWithComp as row (row.w.id)}
        <div class="cell" animate:flip={{ duration: 500 }}>
            <svelte:component this={row.Comp} wheel={row.w} selectedTs={selectedTs} location={row.loc} />
        </div>
    {/each}
    <WheelPicker/>
</section>

<style>
    .grid {
        display: grid;
        gap: 13px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch; /* важно */
    }
    .grid > .cell {
        display: flex;
        align-items: stretch;
        min-width: 0;
    }

    .grid > .cell > :global(*) {
        flex: 1 1 auto;
        min-height: 0;
    }
    @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }
</style>
