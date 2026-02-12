<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './components/Header.svelte';
  import Board from './components/Board.svelte';

  import { currentLocation, initLocation } from './lib/location/store';
  import { selectedTs as selectedTsStore, startLive } from './lib/stores/time';

  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  let lat = -23.22;
  let lon = -44.72;

  let resetUiId = 0;
  let unsubLoc: (() => void) | null = null;
  let unsubTime: (() => void) | null = null;

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
    <Board lat={lat} lon={lon} selectedTs={$selectedTsStore} />
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
</style>