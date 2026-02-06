<!-- src/App.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentLocation, initLocation } from './lib/stores/location';
  import { selectedTs as selectedTsStore, startLive } from './lib/stores/time';
  import { cycles } from './lib/stores/cycle';
  import { CYCLE_META } from './lib/cycles/meta';

  import SwUpdateToast from "./components/SwUpdateToast.svelte";

  import Desktop from "./components/Desktop.svelte";
  import Tablet from "./components/Tablet.svelte";
  import Mobile from "./components/Mobile.svelte";

  import { debug } from './lib/debug';
  const dbg = debug('app', '🧭');
  const { log } = dbg;

  type Layout = 'mobile' | 'tablet' | 'desktop';

  // local mirrors
  let lat = 0;
  let lon = 0;

  let resetUiId = 0;

  let unsubLoc: (() => void) | null = null;
  let onResizeOff: (() => void) | null = null;

  $: cyclesOrdered = ($cycles ?? [])
          .slice()
          .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);

  // layout/orientation
  let layout: Layout = 'desktop';
  let isLandscape = true;
  let vw = 0;
  let vh = 0;

  const isDev = import.meta.env.DEV;

  function pickLayout(width: number): Layout {
    if (width < 768) return 'mobile';
    if (width < 1200) return 'tablet';
    return 'desktop';
  }

  function readViewport(reason = 'manual') {
    const vv = (window as any).visualViewport as VisualViewport | undefined;

    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);

    const nextLandscape = w > h;
    const nextLayout = pickLayout(w);

    const changed =
            (w !== vw) || (h !== vh) ||
            (nextLandscape !== isLandscape) ||
            (nextLayout !== layout);

    vw = w;
    vh = h;
    isLandscape = nextLandscape;
    layout = nextLayout;

    if (changed) {
      log('viewport', {
        reason,
        vw, vh,
        isLandscape,
        layout
      });
    }
  }

  // (опционально) логируем смены именно layout отдельно
  let prevLayout: Layout = layout;
  $: if (layout !== prevLayout) {
    log('layout changed', { from: prevLayout, to: layout, vw, vh, isLandscape });
    prevLayout = layout;
  }

  onMount(() => {
    log('mount', {
      VITE_DEBUG: import.meta.env.VITE_DEBUG,
      VITE_DEBUG_APP: import.meta.env.VITE_DEBUG_APP,
      DEV: import.meta.env.DEV
    });

    initLocation();
    unsubLoc = currentLocation.subscribe((v) => {
      lat = v.lat;
      lon = v.lon;
      resetUiId += 1;
      log('location', { lat, lon, resetUiId });
    });

    startLive();

    readViewport('mount');

    const handler = () => readViewport('resize');
    window.addEventListener('resize', handler, { passive: true });

    const vv = (window as any).visualViewport as VisualViewport | undefined;
    vv?.addEventListener?.('resize', handler, { passive: true });

    onResizeOff = () => {
      window.removeEventListener('resize', handler);
      vv?.removeEventListener?.('resize', handler as any);
    };
  });

  onDestroy(() => {
    log('destroy');
    unsubLoc?.(); unsubLoc = null;
    onResizeOff?.(); onResizeOff = null;
  });
</script>

<svelte:head>
  <title>ChronoCompass{isDev ? ' — DEV' : ''}</title>
</svelte:head>

<SwUpdateToast />

{#if layout === 'desktop'}
  <Desktop
          lat={lat}
          lon={lon}
          cyclesOrdered={cyclesOrdered}
          selectedTs={$selectedTsStore}
          resetUiId={resetUiId}
          viewportWidth={vw}
          viewportHeight={vh}
          isLandscape={isLandscape}
  />
{:else if layout === 'tablet'}
  <Tablet
          lat={lat}
          lon={lon}
          cyclesOrdered={cyclesOrdered}
          selectedTs={$selectedTsStore}
          resetUiId={resetUiId}
          viewportWidth={vw}
          viewportHeight={vh}
          isLandscape={isLandscape}
  />
{:else}
  <Mobile
          lat={lat}
          lon={lon}
          cyclesOrdered={cyclesOrdered}
          selectedTs={$selectedTsStore}
          resetUiId={resetUiId}
          viewportWidth={vw}
          viewportHeight={vh}
          isLandscape={isLandscape}
  />
{/if}
