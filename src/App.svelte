<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './components/Header.svelte';
  import Board from './components/Board.svelte';

  import { currentLocation } from './lib/location/store';
  import { selectedTs as selectedTsStore, startLive } from './lib/time/store';

  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  let resetUiId = 0;
  let unsubLoc: (() => void) | null = null;

  onMount(() => {
    unsubLoc = currentLocation.subscribe((v) => {
      resetUiId += 1;
    });

    startLive();
  });

  onDestroy(() => { unsubLoc?.(); unsubLoc = null; });

  const isDev = import.meta.env.DEV;
</script>

<svelte:head>
  <title>ChronoCompass{isDev ? ' — DEV' : ''}</title>
</svelte:head>

<SwUpdateToast />

<main>
  <div class="container">
    <Header />
    <Board selectedTs={$selectedTsStore} />
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