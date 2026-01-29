<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CycleWheel from './components/CycleWheel.svelte';
  import Header from './components/Header.svelte';

  import { currentLocation, initLocation } from './lib/stores/location';
  import {
    selectedTs as selectedTsStore,
    setSelectedTs,
    onUserActivity,
    startLive,
  } from './lib/stores/time';

  // local mirrors for convenience (avoid $store in markup if you want)
  let selectedTs = Date.now();
  let lat = -23.22;
  let lon = -44.72;

  // signal wheels to reset local UI (when location changes / when we jump to now)
  let resetUiId = 0;

  let unsubLoc: (() => void) | null = null;
  let unsubTime: (() => void) | null = null;

  function handleUserActivity() {
    onUserActivity(); // stops LIVE inside the time store
  }

  function handleSelectTs(ts: number) {
    setSelectedTs(ts); // user-set => stops LIVE inside the time store
  }

  onMount(() => {
    initLocation();
    unsubLoc = currentLocation.subscribe((v) => {
      lat = v.lat;
      lon = v.lon;
      resetUiId += 1;
    });

    unsubTime = selectedTsStore.subscribe((v) => {
      selectedTs = v;
    });

    // default — LIVE
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

<main>
  <div class="container">
    <Header />

    <section class="grid">
      <CycleWheel
              title="Day - Diurnal Cycle"
              kind="day"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Moon - Synodic Cycle"
              kind="moon"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Year - Solar Cycle"
              kind="year"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Plato - Precession Cycle"
              kind="plato"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />
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