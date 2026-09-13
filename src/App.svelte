<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './components/Header.svelte';
  import Board from './components/Board.svelte';
  import Calendar from './components/Calendar.svelte';
  import { CALENDAR_EPOCH_DAY } from './lib/calendar/epoch';

  import { currentLocation } from './lib/location/store';
  import { selectedTs as selectedTsStore } from './lib/time/store';

  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  let resetUiId = 0;
  let unsubLoc: (() => void) | null = null;
  let section = typeof window !== 'undefined' ? window.location.hash.slice(1) || 'calendar' : 'calendar';
  $: calendarMode = section === 'calendar' || section === 'gregorian';

  onMount(() => {
    const updatePage = () => section = window.location.hash.slice(1) || 'calendar';
    window.addEventListener('hashchange', updatePage);
    unsubLoc = currentLocation.subscribe((v) => {
      resetUiId += 1;
    });
    return () => window.removeEventListener('hashchange', updatePage);
  });

  onDestroy(() => {
    unsubLoc?.();
    unsubLoc = null;
  });

  const isDev = import.meta.env.DEV;
</script>

<svelte:head>
  <title>{section === 'calendar' ? 'Epoch Calendar · ' : section === 'gregorian' ? 'Gregorian Calendar · ' : ''}ChronoCompass{isDev ? ' — DEV' : ''}</title>
</svelte:head>

<SwUpdateToast />

<main class:calendarMode>
  <div class="container">
    <Header {calendarMode} {section} />
    <div class="boardSlot">
      {#if section === 'calendar'}
        <Calendar epochDay={CALENDAR_EPOCH_DAY} />
      {:else if section === 'gregorian'}
        <section class="placeholder"><h1>Gregorian Calendar</h1><p>This section is coming soon.</p></section>
      {:else}
        <Board selectedTs={$selectedTsStore} />
      {/if}
    </div>
  </div>
</main>

<style>
  .placeholder { margin: 48px auto; text-align: center; padding: 24px; }
  .placeholder p { color: var(--muted); }
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
    main.calendarMode { height: auto; overflow: visible; }
    .calendarMode .container { height: auto; display: block; overflow: visible; }
    .calendarMode .boardSlot { display: block; overflow: visible; }
  }

</style>
