<script lang="ts">
    import Compass from './Compass.svelte';
    import Wheel from './Wheel.svelte';

    import { boardItems } from '../lib/board/store';
    import { CYCLE_META } from '../lib/cycles/meta';

    // TODO - legacy wheel cycles
    import { cycles } from '../lib/stores/cycle';

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;

    // стабильный порядок на всякий — boardItems уже отсортирован, но лучше не надеяться
    $: items = ($boardItems ?? []).slice().sort((a, b) => a.order - b.order);

    // если позже появится несколько виджетов — можно будет тут сортировать/фильтровать

    // TODO - legacy wheel cycles
    $: cyclesOrdered = ($cycles ?? [])
        .slice()
        .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);
</script>

<section class="grid">
    {#each items as it (it.wheelId)}
        {#if it.wheelType === 'compass'}
            <Compass wheelId={it.wheelId}
                    selectedTs={selectedTs}
                    boardRoles={it.roles}
                    boardTitle={it.title}
            />
        {:else}
            <!-- позже: любые другие колёса с доски -->
            <!--{#if wheelTypeToCycleKind(it.wheelType)}-->
            <!--    <Wheel-->
            <!--            kind={wheelTypeToCycleKind(it.wheelType)}-->
            <!--            lat={lat}-->
            <!--            lon={lon}-->
            <!--            selectedTs={selectedTs}-->
            <!--    />-->
            <!--{/if}-->
        {/if}
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
