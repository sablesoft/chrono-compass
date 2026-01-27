<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CycleWheel from './components/CycleWheel.svelte';
  import {formatDateTime, formatCoords, ms} from './lib/format';
  import { loadPlaces, addPlace, removePlace, type Place } from './lib/places/store';

  // global time (single source of truth)
  let selectedTs = Date.now();

  // LIVE clock mode
  let isLive = false;
  let liveTimer: ReturnType<typeof setInterval> | null = null;

  // location
  let lat = -23.22;
  let lon = -44.72;
  let placeName = 'Paraty (manual)';

  // saved places
  let places: Place[] = [];
  let newPlaceName = '';

  // signal wheels to reset local UI (highlight/active/spin state)
  let resetUiId = 0;

  function startLive() {
    if (isLive) return;
    isLive = true;

    // поставить "сейчас" сразу
    selectedTs = Date.now();
    resetUiId += 1; // сбросить UI/локи на колёсах

    // обновлять раз в минуту (с выравниванием можно позже)
    liveTimer = setInterval(() => {
      selectedTs = Date.now();
    }, 60_000);
  }

  function stopLive() {
    if (!isLive) return;
    isLive = false;
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  }

  function toggleNow() {
    if (isLive) stopLive();
    else startLive();
  }

  // reason: 'user' => выключаем live, 'system' => не выключаем
  function onSelectTs(ts: number) {
    // любое внешнее изменение времени должно выключать live
    // (иначе live перетрёт)
    stopLive();
    selectedTs = ms(ts);
  }

  function onUserActivity() {
    stopLive();
  }

  function load() {
    places = loadPlaces();
  }

  function saveCurrentPlace() {
    const name = newPlaceName.trim();
    if (!name) return;
    addPlace(name, lat, lon);
    newPlaceName = '';
    load();
  }

  function pickPlace(p: Place) {
    // смена места — это пользовательское действие => выключаем live
    stopLive();
    lat = p.lat;
    lon = p.lon;
    placeName = p.name;
    resetUiId += 1;
  }

  function delPlace(p: Place) {
    places = removePlace(p.id);
  }

  onMount(() => {
    load();
    startLive();
  });

  onDestroy(() => {
    if (liveTimer) clearInterval(liveTimer);
  });
</script>

<main>
  <div class="container">
    <header class="topbar">
      <div class="title">
        <div class="h">Wheels</div>
        <div class="sub">{formatDateTime(selectedTs)}{isLive ? ' · LIVE' : ''}</div>
      </div>

      <div class="actions">
        <button on:click={toggleNow} class:active={isLive}>Now</button>
      </div>
    </header>

    <section class="location">
      <div class="line">
        <strong>Location:</strong> {placeName} · {formatCoords(lat, lon)}
      </div>

      <div class="save">
        <input placeholder="Save current coords as…" bind:value={newPlaceName} />
        <button on:click={saveCurrentPlace}>Save</button>
      </div>

      {#if places.length > 0}
        <div class="places">
          {#each places as p (p.id)}
            <div class="place">
              <button class="pick" on:click={() => pickPlace(p)}>{p.name}</button>
              <span class="coords">{formatCoords(p.lat, p.lon)}</span>
              <button class="del" on:click={() => delPlace(p)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="grid">
      <CycleWheel
              title="Day"
              kind="day"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={onUserActivity}
              onSelectTs={onSelectTs}
      />

      <CycleWheel
              title="Moon"
              kind="moon"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={onUserActivity}
              onSelectTs={onSelectTs}
      />

      <CycleWheel
              title="Year"
              kind="year"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={onUserActivity}
              onSelectTs={onSelectTs}
      />

      <CycleWheel
              title="Plato"
              kind="plato"
              {lat}
              {lon}
              {selectedTs}
              {resetUiId}
              onUserActivity={onUserActivity}
              onSelectTs={onSelectTs}
      />
    </section>

    <footer class="note">
      LIVE обновляется раз в минуту. Любое действие на колесе выключает LIVE.
    </footer>
  </div>
</main>

<style>
  main {
    padding: 24px;
    background: #0b0b0c;
    min-height: 100vh;
    color: #e7e7ea;
    width: 100%;
    overflow-x: hidden;
    font-size: 18px;
  }

  .container {
    width: clamp(1200px, calc(100vw - 48px), 2600px);
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 14px;
  }

  .h { font-size: 18px; font-weight: 700; opacity: 0.95; }
  .sub { font-size: 13px; opacity: 0.75; margin-top: 2px; }

  button {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(231,231,234,0.18);
    background: rgba(231,231,234,0.06);
    color: inherit;
    cursor: pointer;
  }
  button.active {
    border-color: rgba(231,231,234,0.35);
    background: rgba(231,231,234,0.10);
  }

  .location {
    border: 1px solid rgba(231, 231, 234, 0.10);
    background: rgba(231, 231, 234, 0.03);
    border-radius: 16px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .line { font-size: 14px; opacity: 0.9; margin-bottom: 10px; }
  .save { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
  input {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(231,231,234,0.14);
    background: rgba(231,231,234,0.04);
    color: inherit;
    outline: none;
  }
  .places { display: grid; gap: 8px; }
  .place { display: flex; align-items: center; gap: 10px; }
  .pick { padding: 6px 10px; border-radius: 10px; }
  .coords { font-size: 12px; opacity: 0.65; }
  .del { margin-left: auto; padding: 6px 10px; opacity: 0.8; }

  .grid {
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
    align-items: start;
  }
  @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }

  .note { margin-top: 14px; font-size: 12px; opacity: 0.55; }
</style>