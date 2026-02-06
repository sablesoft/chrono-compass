<script lang="ts">
    import Header from './desktop/Header.svelte';
    import Wheel from './Wheel.svelte';

    export let lat: number;
    export let lon: number;
    export let selectedTs: number;
    export let cyclesOrdered: any[] = [];

    export let resetUiId = 0;

    export let viewportWidth = 0;
    export let viewportHeight = 0;
    export let isLandscape = true;

    const isDev = import.meta.env.DEV;
</script>

<main>
    <div class="container">
        <Header />

        <section class="grid">
            {#each cyclesOrdered as kind (kind)}
                <Wheel
                        kind={kind}
                        lat={lat}
                        lon={lon}
                        selectedTs={selectedTs}
                />
            {/each}
        </section>
    </div>
</main>

<style>
    main {
        padding: 16px;
        background: var(--bg);
        min-height: 100vh;
        color: var(--fg);
        width: 98%;
        overflow-x: visible;
        font-size: 18px;
    }

    .container {
        width: clamp(1200px, calc(100vw - 28px), 2600px);
        margin: 0 auto;
    }

    .grid {
        display: grid;
        gap: 13px;
        grid-template-columns: 1fr;
        align-items: start;
    }
    @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }
</style>
