<!--src/component/Board.svelte -->
<script lang="ts">
    import { boardItems } from '../lib/board/store';
    import { resolveLocationById } from '../lib/location/store';
    import { CYCLE_META } from '../lib/cycles/meta';
    import { getWheelEntry } from '../lib/board/registry';

    import Compass from './Compass.svelte';
    import Wheel from './Wheel.svelte';
    import Cycle from './Cycle.svelte';

    import type {WheelObserverState} from "../lib/wheel/types";
    import type {BoardWheel} from "../lib/board/types";

    // TODO - legacy wheel cycles
    import { cycles } from '../lib/stores/cycle';

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;

    function pickComponent(w: BoardWheel) {
        const entry = getWheelEntry(w.wheelType);
        return entry.ui === 'compass' ? Compass : Cycle;
    }

    function wheelLocation(w: BoardWheel) {
        return resolveLocationById((w.observer as WheelObserverState)?.locationId);
    }

    // стабильный порядок на всякий — boardItems уже отсортирован, но лучше не надеяться
    $: items = ($boardItems ?? []).slice().sort((a, b) => a.order - b.order);

    // если позже появится несколько виджетов — можно будет тут сортировать/фильтровать

    // TODO - legacy wheel cycles
    $: cyclesOrdered = ($cycles ?? [])
        .slice()
        .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);
</script>

<section class="grid">
    {#each items as w (w.wheelId)}
        {@const C = pickComponent(w)}
        <svelte:component
                this={C}
                wheel={w}
                selectedTs={selectedTs}
                location={wheelLocation(w)}
        />
    {/each}
    <!-- TODO - старый список cycles — временно оставляем -->
    {#each cyclesOrdered as kind (kind)}
        <Wheel
                kind={kind}
                lat={lat}
                lon={lon}
                selectedTs={selectedTs}
        />
    {/each}
</section>

<style>
    .grid {
        display: grid;
        gap: 13px;
        grid-template-columns: 1fr;
        align-items: start;
    }
    @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }
</style>
