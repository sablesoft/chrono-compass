<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CycleWheel from './components/CycleWheel.svelte';
  import Header from './components/Header.svelte';

  import { currentLocation } from './lib/stores/location';
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
</script>

<main>
  <div class="container">
    <Header />

    <section class="grid">
      <CycleWheel
              title="Day"
              kind="day"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Moon"
              kind="moon"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Year"
              kind="year"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />

      <CycleWheel
              title="Plato"
              kind="plato"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={handleUserActivity}
              onSelectTs={handleSelectTs}
      />
    </section>

    <footer class="note">
      LIVE обновляется раз в минуту. Любое действие выключает LIVE.
    </footer>
  </div>
</main>

<style>
  main {
    padding: 24px;
    background: var(--bg);
    min-height: 100vh;
    color: var(--fg);
    width: 100%;
    overflow-x: hidden;
    font-size: 18px;
  }

  .container {
    width: clamp(1200px, calc(100vw - 48px), 2600px);
    margin: 0 auto;
  }

  .grid {
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
    align-items: start;
  }
  @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }

  .note {
    margin-top: 14px;
    font-size: 18px;
    opacity: 0.55;
  }
</style>