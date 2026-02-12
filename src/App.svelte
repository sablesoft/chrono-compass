<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './components/Header.svelte';
  import Board from './components/Board.svelte';

  import { currentLocation, initLocation } from './lib/stores/location';
  import { selectedTs as selectedTsStore, startLive } from './lib/stores/time';

  import { cycles } from './lib/stores/cycle';
  import { CYCLE_META } from "./lib/cycles/meta";
  import Wheel from "./components/Wheel.svelte";
  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  let lat = -23.22;
  let lon = -44.72;

  let resetUiId = 0;
  let unsubLoc: (() => void) | null = null;
  let unsubTime: (() => void) | null = null;

  $: cyclesOrdered = ($cycles ?? [])
          .slice()
          .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);

  onMount(() => {
    initLocation();
    unsubLoc = currentLocation.subscribe((v) => {
      lat = v.lat;
      lon = v.lon;
      resetUiId += 1;
    });

    startLive();
  });

  onDestroy(() => {
    unsubLoc?.(); unsubLoc = null;
    unsubTime?.(); unsubTime = null;
  });

  const isDev = import.meta.env.DEV;
</script>

<svelte:head>
  <title>ChronoCompass{isDev ? ' — DEV' : ''}</title>
</svelte:head>

<SwUpdateToast />

<main>
  <div class="container">
    <Header />

    <!-- Новый board -->
    <Board lat={lat} lon={lon} selectedTs={$selectedTsStore} />

    <!-- Старый список cycles — временно оставляем -->
    <section class="grid legacy">
      {#each cyclesOrdered as kind (kind)}
        <Wheel
                kind={kind}
                lat={lat}
                lon={lon}
                selectedTs={$selectedTsStore}
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

  .legacy { margin-top: 16px; opacity: 0.98; }
</style>