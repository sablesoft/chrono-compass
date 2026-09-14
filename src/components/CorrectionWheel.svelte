<script lang="ts">
  import { harmonicSuffix, HARMONIC_ACTIONS } from '../lib/calendar/dreamspell';
  export let showDreamspell = false;
  import { calendarEventDetails, calendarEventMarker } from '../lib/calendar/events';
  import type { LayerEvent } from '../lib/calendar/layers';
  import { createWheelGeom } from '../lib/wheel/geom';
  export let days: Array<{number: number; absolute: number; address: string}>;
  export let events: LayerEvent[] = [];
  export let timezone = 'UTC';
  export let todayDay: number;
  export let showGregorian: boolean;
  export let civilLabel: (day: number, full?: boolean) => string;
  // Reuse the board wheel's east-first counterclockwise geometry and dimensions.
  const geom = createWheelGeom(4);
  const sectors = ['red', 'white', 'blue', 'gold'].map((color, i) => {
    const angle = geom.spokeAngleDeg(i);
    const start = geom.polarToXY(geom.rOuter, angle - 45);
    const end = geom.polarToXY(geom.rOuter, angle + 45);
    return {
      color, label: geom.polarToXY(geom.rOuter * .59, angle),
      path: `M ${geom.cx} ${geom.cy} L ${start.x} ${start.y} A ${geom.rOuter} ${geom.rOuter} 0 0 1 ${end.x} ${end.y} Z`
    };
  });
</script>

<div class="correction">
  <svg viewBox="0 0 1000 1000" role="img" aria-label={days.length === 1 ? 'S' : 'S1 east, S2 north, S3 west, S4 south'}>
    {#each days as day, i}
      {@const single = days.length === 1}
      {@const named = showDreamspell && !single}
      {@const x = single ? geom.cx : sectors[i].label.x}
      {@const y = single ? geom.cy : sectors[i].label.y}
      <g class:today={day.absolute === todayDay} aria-current={day.absolute === todayDay ? 'date' : undefined}>
        <title>{single ? 'S' : `S${day.number}`}{harmonicSuffix(day.number, named)} · {day.address}{showGregorian ? ` · ${civilLabel(day.absolute, true)}` : ''}</title>
        {#if single}
          <circle class="field" cx={geom.cx} cy={geom.cy} r={geom.rOuter} fill="var(--calendar-white)" />
        {:else}
          <path class="field" d={sectors[i].path} fill={`var(--calendar-${sectors[i].color})`} />
        {/if}
        {#if named}<text class="action" {x} y={y - 85}>{HARMONIC_ACTIONS[i]}</text>{/if}
        <text class="number" {x} y={y + (showGregorian ? -8 : 14)}>{single ? 'S' : `S${day.number}`}</text>
        {#each events.filter(event => event.day === day.absolute) as event}
          <text class="event" x={event.corner === 'top-left' ? x - 85 : x + 85} y={event.corner === 'bottom-right' ? y + 90 : y - 55} aria-label={calendarEventDetails(event, timezone)}><title>{calendarEventDetails(event, timezone)}</title>{calendarEventMarker(event)}</text>
        {/each}
        {#if showGregorian}<text class="civil" {x} y={y + 48}>{civilLabel(day.absolute)}</text>{/if}
        {#if day.absolute === todayDay}<circle class="todayDot" cx={x} cy={y + (showGregorian ? 80 : 55)} r="8" />{/if}
      </g>
    {/each}
    <circle class="rim" cx={geom.cx} cy={geom.cy} r={geom.rOuter} />
  </svg>
</div>

<style>
  .correction { display: flex; justify-content: center; }
  svg { display: block; width: min(100%, 460px); height: auto; overflow: visible; }
  .field { stroke: var(--panel); stroke-width: 4; }
  .rim { fill: none; stroke: var(--ring); stroke-width: 3; pointer-events: none; }
  text { fill: var(--fg); text-anchor: middle; font-family: inherit; }
  .action { font-size: 32px; font-weight: 500; }
  .number { font-size: 64px; font-weight: 600; }
  .event { font-size: 38px; cursor: help; }
  .civil { font-size: 32px; }
  .today .number { text-decoration: underline; text-underline-offset: 10px; }
  .todayDot { fill: var(--fg); }
</style>
