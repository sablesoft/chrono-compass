<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './components/Header.svelte';
  import Board from './components/Board.svelte';

  import { currentLocation } from './lib/location/store';
  import { selectedTs as selectedTsStore } from './lib/time/store';

  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  let resetUiId = 0;
  let unsubLoc: (() => void) | null = null;

  onMount(() => {
    unsubLoc = currentLocation.subscribe((v) => {
      resetUiId += 1;
    });
  });

  onDestroy(() => {
    unsubLoc?.();
    unsubLoc = null;
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
    <div class="boardSlot">
      <Board selectedTs={$selectedTsStore} />
    </div>
  </div>
</main>

<style>
  main {
    padding: var(--app-main-pad, 16px);
    background: var(--bg);
    min-height: 100vh;
    color: var(--fg);
    width: 100%;
    overflow-x: hidden;
    font-size: var(--app-font-size, 18px);
    box-sizing: border-box;
  }

  .container {
    width: min(2600px, 100%);
    margin: 0 auto;
    min-width: 0;
  }
  .boardSlot {
    min-width: 0;
  }

  @media (max-width: 640px) {
    main {
      min-height: 100dvh;
      height: 100dvh;
      overflow: hidden;
    }
    .container {
      height: 100%;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
    }
    .boardSlot {
      min-height: 0;
      overflow: hidden;
      display: grid;
    }
  }

</style>
