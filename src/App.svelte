<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CycleWheel from './components/CycleWheel.svelte';
  import {formatDateTime, formatCoords, ms} from './lib/format';
  import { loadPlaces, addPlace, removePlace, type Place } from './lib/places/store';
  import ThemeSwitcher from "./components/ThemeSwitcher.svelte";

  // global time (single source of truth)
  let selectedTs = Date.now();

  // LIVE clock mode
  let isLive = false;

  // location
  let lat = -23.22;
  let lon = -44.72;
  let placeName = 'Paraty (manual)';

  // saved places
  let places: Place[] = [];
  let newPlaceName = '';

  // signal wheels to reset local UI (highlight/active/spin state)
  let resetUiId = 0;

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

  function toggleNow() {
    if (isLive) stopLive();
    else startLive();
  }

  function delPlace(p: Place) {
    places = removePlace(p.id);
  }

  let liveTimer: ReturnType<typeof setInterval> | null = null;
  let liveAlignTimer: ReturnType<typeof setTimeout> | null = null;

  function startLive() {
    if (isLive) return;
    isLive = true;

    selectedTs = Date.now();
    resetUiId += 1;

    // 1) выравниваемся на следующую границу минуты
    const now = Date.now();
    const msToNextMinute = 60_000 - (now % 60_000);

    if (liveAlignTimer) clearTimeout(liveAlignTimer);
    liveAlignTimer = setTimeout(() => {
      // ровно на границе минуты
      selectedTs = Date.now();

      // 2) дальше — строго каждые 60s
      if (liveTimer) clearInterval(liveTimer);
      liveTimer = setInterval(() => {
        selectedTs = Date.now();
      }, 60_000);
    }, msToNextMinute + 5); // +5ms буфер на таймеры/планировщик
  }

  function stopLive() {
    if (!isLive) return;
    isLive = false;

    if (liveAlignTimer) { clearTimeout(liveAlignTimer); liveAlignTimer = null; }
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
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
      <div class="left">
        <div class="h">Time Wheels</div>
      </div>

      <div class="center">
        <div class="time">
          {formatDateTime(selectedTs)}
          {#if isLive}
            <span class="live">LIVE</span>
          {/if}
        </div>
      </div>

      <div class="right">
        <ThemeSwitcher />
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

  /* topbar в 3 колонки */
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 16px 20px;
    gap: 12px;
    margin-bottom: 14px;
  }

  .left { justify-self: start; }
  .center { justify-self: center; text-align: center; }
  .right { justify-self: end; }

  .h {
    font-size: 38px;
    font-weight: 650;
    opacity: 0.95;
  }

  .time {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .live {
    margin-left: 10px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  button {
    padding: 8px 14px;
    border-radius: 12px;
    border: 1px solid var(--btn-border);
    background: var(--btn-bg);
    color: inherit;
    cursor: pointer;
  }

  button.active {
    background: color-mix(in oklab, var(--btn-bg), var(--fg) 12%);
  }

  /* location card */
  .location {
    border: 1px solid var(--panel-border);
    background: var(--panel);
    border-radius: 16px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }

  input {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: inherit;
    outline: none;
  }

  .coords { font-size: 18px; opacity: 0.65; }

  .grid {
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
    align-items: start;
  }
  @media (min-width: 980px) { .grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1400px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }
</style>