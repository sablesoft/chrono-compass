<!--src/component/Board.svelte -->
<script lang="ts">
    import { boardItems } from '../lib/board/store';
    import { flip } from 'svelte/animate';
    import { currentLocationId, resolveLocationById } from '../lib/location/store';
    import { CYCLE_META } from '../lib/cycle/meta';
    import { getWheelEntry } from '../lib/board/registry';

    import Compass from './Compass.svelte';
    import Wheel from './Wheel.svelte';
    import Cycle from './Cycle.svelte';

    import type {WheelObserverState} from "../lib/wheel/types";
    import type {BoardWheel} from "../lib/board/types";

    // TODO - legacy wheel cycles
    import { cycles } from '../lib/stores/cycle';
    import WheelPicker from "./WheelPicker.svelte";
    import {DEFAULT_LOCATION_ID} from "../lib/location/types";

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;

    function pickComponent(w: BoardWheel) {
        const entry = getWheelEntry(w.wheelType);
        return entry.ui === 'compass' ? Compass : Cycle;
    }

    // стабильный порядок на всякий — boardItems уже отсортирован, но лучше не надеяться
    $: globalLocId = $currentLocationId;
    $: items = ($boardItems ?? []).slice().sort((a, b) => a.order - b.order);

    $: itemsView = items.map((w) => {
        const obs = (w.observer as WheelObserverState) ?? { locationId: DEFAULT_LOCATION_ID, locked: false };
        const id = obs.locked ? obs.locationId : globalLocId;
        return { w, loc: resolveLocationById(id) };
    });

    // если позже появится несколько виджетов — можно будет тут сортировать/фильтровать

    // TODO - legacy wheel cycles
    $: cyclesOrdered = ($cycles ?? [])
        .slice()
        .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);

    $: itemsViewWithComp = itemsView.map((row) => ({
        ...row,
        Comp: pickComponent(row.w)
    }));
</script>

<section class="grid">
    {#each itemsViewWithComp as row (row.w.wheelId)}
        <div class="cell" animate:flip={{ duration: 500 }}>
            <svelte:component this={row.Comp} wheel={row.w} selectedTs={selectedTs} location={row.loc} />
        </div>
    {/each}

    <!-- TODO - старый список cycles — временно оставляем -->
    {#each cyclesOrdered as kind (kind)}
        <Wheel kind={kind} lat={lat} lon={lon} selectedTs={selectedTs}/>
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
