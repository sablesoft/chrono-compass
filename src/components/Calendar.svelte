<script lang="ts">
  import { onMount } from 'svelte';
  import { dreamspellSuffix, harmonicSuffix, dreamspellYearSuffix, HEPTAD_DAYS } from '../lib/calendar/dreamspell';
  import DocsModal from './DocsModal.svelte';
  import DropdownButton from './DropdownButton.svelte';
  import { DISPLAY_OPTIONS, GREGORIAN_DISPLAY_OPTIONS, EVENT_CORNERS, readDisplayOptions, saveDisplayOptions, resolveCalendarLayers } from '../lib/calendar/layers';
  import { civilDayAt, calendarEventDetails, calendarEventMarker } from '../lib/calendar/events';
  import { useDocs } from '../lib/docs';
  import CorrectionWheel from './CorrectionWheel.svelte';
  import { currentLocation } from '../lib/location/store';
  import { PHRASES, correctionDays, fromDay, toDay, movePage, notation, waveOptions,
    yearCount, fromGregorianDay, type CalendarPage } from '../lib/calendar/core';

  import { GREGORIAN_MONTHS, gregorianMonth, moveGregorianMonth, epochDayLabel, type GregorianPage } from '../lib/calendar/gregorian';
  export let gregorian = false;
  $: calendarName = gregorian ? 'Gregorian Calendar' : 'Epoch Calendar';
  $: options = gregorian ? GREGORIAN_DISPLAY_OPTIONS : DISPLAY_OPTIONS;
  const docs = useDocs(() => gregorian ? 'calendars/gregorian-calendar.md' : 'calendars/epoch-calendar.md', { getTitle: () => calendarName });
  const docsState = docs.state;

  export let epochDay: number;
  let clock = Date.now();
  let page: CalendarPage | null = null;
  let displayOptions: string[] = [];
  $: showDreamspell = !gregorian && displayOptions.includes('dreamspell');
  $: showGregorian = displayOptions.includes('gregorian');
  let gc = 1, phrase = 1, wave = 1, year = 1, moon = 1;
  let gregorianPage: GregorianPage | null = null;
  let civilYear = 2026, civilMonth = 1;
  let era = 'CE';
  let weekStart: 'Mon' | 'Sun' = 'Sun';
  $: weekdays = weekStart === 'Mon' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let error = '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $: timezone = $currentLocation?.tz || 'UTC';
  $: todayDay = civilDayAt(clock, timezone) - epochDay;
  $: today = fromDay(todayDay);
  $: if (!page) selectPage(today);
  $: civilToday = fromGregorianDay(epochDay + todayDay);
  $: if (!gregorianPage) selectGregorian(civilToday);
  $: gregorianGrid = gregorianPage ? gregorianMonth(gregorianPage, epochDay, weekStart) : {days: [], offset: 0};
  $: showEpoch = gregorian && displayOptions.includes('epoch');
  $: count = gregorian ? gregorianGrid.days.length : page ? (page.moon === 14 ? correctionDays(page) : 28) : 0;
  $: days = gregorian ? gregorianGrid.days : page ? Array.from({ length: count }, (_, i) => ({
    number: i + 1, absolute: toDay({ ...page!, day: i + 1 }),
    address: notation({ ...page!, day: i + 1 })
  })) : [];
  $: layerData = days.length ? resolveCalendarLayers(displayOptions, days[0].absolute, days[days.length - 1].absolute, epochDay, timezone) : {layers: [], events: []};
  $: events = layerData.events;
  $: title = gregorian && gregorianPage ? GREGORIAN_MONTHS[gregorianPage.month - 1] : page?.moon === 14 ? (count === 1 ? 'Free Day' : 'Free Circle') : `Month ${page?.moon}${dreamspellSuffix(page?.moon ?? 0, showDreamspell)}`;
  $: waves = waveOptions(phrase);
  $: if (!waves.includes(wave)) wave = waves[0] ?? 1;
  $: maxYear = yearCount(phrase, wave);
  $: if (year > maxYear) year = maxYear;

  function selectGregorian(value: GregorianPage) {
    gregorianMonth(value, epochDay);
    gregorianPage = {year: value.year, month: value.month};
    civilYear = value.year <= 0 ? 1 - value.year : value.year;
    civilMonth = value.month;
    era = value.year <= 0 ? 'BCE' : 'CE';
    error = '';
  }
  function selectToday() { if (gregorian) selectGregorian(civilToday); else selectPage(today); }
  function selectPage(value: CalendarPage) {
    page = { gc: value.gc, phrase: value.phrase, wave: value.wave, year: value.year, moon: value.moon };
    ({ gc, phrase, wave, year, moon } = page);
    error = '';
  }
  function navigate(direction: -1 | 1) {
    try { if (gregorian && gregorianPage) selectGregorian(moveGregorianMonth(gregorianPage, direction)); else if (page) selectPage(movePage(page, direction)); }
    catch (e) { error = e instanceof Error ? e.message : 'Date is out of range'; }
  }
  function applySelection() {
    try {
      if (gregorian) {
        if (!Number.isInteger(civilYear) || civilYear < 1) throw new RangeError('Enter a positive year and choose CE or BCE.');
        selectGregorian({year: era === 'BCE' ? 1 - civilYear : civilYear, month: civilMonth});
        return;
      }
      const chosen = { gc, phrase, wave, year, moon };
      toDay({ ...chosen, day: 1 });
      selectPage(chosen);
    } catch (e) { error = e instanceof Error ? e.message : 'Check the date'; }
  }
  function civilLabel(absolute: number, full = false): string {
    const d = fromGregorianDay(epochDay + absolute);
    const y = d.year <= 0 ? `${1 - d.year} BCE` : String(d.year);
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][((epochDay + absolute + 3) % 7 + 7) % 7];
    return `${d.day} ${months[d.month - 1]}${full ? ` ${y}` : `, ${weekday}`}`;
  }
  function changeDisplayOptions(next: string[]) {
    displayOptions = next;
    try { saveDisplayOptions(localStorage, next, options); } catch {}
  }
  function saveWeekStart(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    weekStart = select.value === 'Sun' ? 'Sun' : 'Mon';
    try { localStorage.setItem('chrono-gregorian-week-start', weekStart); } catch {}
  }
  onMount(() => {
    try { weekStart = localStorage.getItem('chrono-gregorian-week-start') === 'Mon' ? 'Mon' : 'Sun'; } catch {}
    try { displayOptions = readDisplayOptions(localStorage, options); } catch {}
    const timer = setInterval(() => clock = Date.now(), 1000);
    return () => clearInterval(timer);
  });
</script>

<section class="calendar" aria-label={calendarName}>
  <div class="heading">
    <div><div class="calendarTitle"><p class="eyebrow">{calendarName.toUpperCase()}</p><button class="infoButton" type="button" aria-label={`About ${calendarName}`} title={`About ${calendarName}`} on:click={docs.openDocs}>i</button></div><h1 aria-live="polite">{title}</h1></div>
    <div class="displayOptions"><DropdownButton label="Display options" items={options} value={displayOptions} onChange={changeDisplayOptions} buttonClass="calendarOptionsButton" /></div>
    <button class="todayButton" on:click={selectToday}>Today</button>
  </div>
  {#if page}
    {#if gregorian && gregorianPage}
      <p class="coordinate">{gregorianPage.year <= 0 ? `${1 - gregorianPage.year} BCE` : `${gregorianPage.year} CE`}</p>
    {:else}
    <p class="coordinate">GC {page.gc} / A {page.phrase}({PHRASES[page.phrase - 1]}) /
      {page.wave === 0 ? 'X' : `W ${page.wave}${dreamspellSuffix(page.wave, showDreamspell)}`} / Y {page.year}{dreamspellYearSuffix(page.year, page.wave, PHRASES[page.phrase - 1], showDreamspell)}</p>
    {/if}
    <form class="selectors" class:gregorianSelectors={gregorian} on:submit|preventDefault={applySelection}>
      {#if gregorian}
        <label>Era<select aria-label="Gregorian era" bind:value={era}><option value="CE">CE</option><option value="BCE">BCE</option></select></label>
        <label>Year<input aria-label="Gregorian year" type="number" min="1" max={era === 'BCE' ? 10000 : 9999} step="1" required bind:value={civilYear} /></label>
        <label>Month<select aria-label="Gregorian month" bind:value={civilMonth}>{#each GREGORIAN_MONTHS as name, i}<option value={i + 1}>{name}</option>{/each}</select></label>
        <label>Week starts<select aria-label="First day of week" bind:value={weekStart} on:change={saveWeekStart}><option value="Mon">Mon</option><option value="Sun">Sun</option></select></label>
      {:else}
      <label>Great Cycle<input aria-label="Great Cycle GC" type="number" min="-1000" max="1000" step="1" required bind:value={gc} /></label>
      <label>Age<select aria-label="Age A" bind:value={phrase}>{#each PHRASES as type, i}<option value={i + 1}>{i + 1} ({type})</option>{/each}</select></label>
      <label>Wave<select aria-label="Wave W or interval X" bind:value={wave}>{#each waves as w}<option value={w}>{w === 0 ? `X · ${PHRASES[phrase - 1]} yr` : `${w}${dreamspellSuffix(w, showDreamspell)}`}</option>{/each}</select></label>
      <label>Year<select aria-label="Year Y" bind:value={year}>{#each Array.from({length: maxYear}, (_, i) => i + 1) as y}<option value={y}>{y}{dreamspellYearSuffix(y, wave, PHRASES[phrase - 1], showDreamspell)}</option>{/each}</select></label>
      <label>Month<select aria-label="Month or free days" bind:value={moon}><option value={14}>Free Days</option>{#each Array.from({length: 13}, (_, i) => i + 1) as m}<option value={m}>Month {m}{dreamspellSuffix(m, showDreamspell)}</option>{/each}</select></label>
      {/if}
      <button type="submit">Go</button>
    </form>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="navigation">
      <button aria-label={gregorian ? "Previous month" : "Previous period"} on:click={() => navigate(-1)}>←</button>
      <div class="periodMeta"><span>{gregorian ? `${count} days` : page.moon === 14 ? `${count} ${count === 1 ? 'day' : 'days'}` : `${page.moon} / 13`}</span>
        {#if !gregorian && showGregorian && days.length}<small>{civilLabel(days[0].absolute, true)} — {civilLabel(days[days.length - 1].absolute, true)}</small>{/if}
        {#if showEpoch && days.length}<small class="epochRange">{days[0].address} — {days[days.length - 1].address}</small>{/if}</div>
      <button aria-label={gregorian ? "Next month" : "Next period"} on:click={() => navigate(1)}>→</button>
    </div>
    {#if !gregorian && page.moon === 14}
      <CorrectionWheel {showDreamspell} {events} {timezone} {days} {todayDay} {showGregorian} {civilLabel} />
    {:else}
      <div class="days" aria-label={title}>
        {#if gregorian}
          {#each weekdays as weekday}<div class="weekday">{weekday}</div>{/each}
          {#each Array.from({length: gregorianGrid.offset}) as _}<div aria-hidden="true"></div>{/each}
        {/if}
        {#each days as day}
          <div class="day" class:today={day.absolute === todayDay} style:--day-color={gregorian ? 'var(--btn-bg)' : `var(--calendar-${['red', 'white', 'blue', 'gold'][Math.floor((day.number - 1) / 7) % 4]})`} aria-current={day.absolute === todayDay ? 'date' : undefined} title={day.address}>
            <span class="dayNumber">{day.number}</span>
            {#if !gregorian && showGregorian}<span class="civil">{civilLabel(day.absolute)}</span>{/if}
            {#if showEpoch}<span class="civil" title={day.address}>{epochDayLabel(day.absolute)}</span>{/if}
            {#each EVENT_CORNERS as corner}
              <div class="eventMarkers" class:lunarMarkers={corner === 'top-left'} class:bindMarkers={corner === 'bottom-right'}>
                {#each events.filter(event => event.day === day.absolute && event.corner === corner) as event}
                  <span class="eventMarker" title={calendarEventDetails(event, timezone)} aria-label={calendarEventDetails(event, timezone)}>{calendarEventMarker(event)}</span>
                {/each}
              </div>
            {/each}
            {#if day.absolute === todayDay}<span class="todayDot" aria-label="Today"></span>{/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if showDreamspell && page.moon !== 14}
      <section class="seasonEvents eventGroup" aria-label="Weeks and weekdays">
        <h2>Weeks · Harmonic</h2>
        <ul>{#each [1, 2, 3, 4] as week}<li><span class="weekBullet" style:background={`var(--calendar-${['red', 'white', 'blue', 'gold'][week - 1]})`} aria-hidden="true"></span><span>Week {week}{harmonicSuffix(week, true)} · Days {(week - 1) * 7 + 1}–{week * 7}</span></li>{/each}</ul>
        <h2>Days of the week · Heptad</h2>
        <ul>{#each HEPTAD_DAYS as name, i}<li><span class="eventBullet">Day {i + 1}</span><span><strong>{name}</strong> · Month days {i + 1}, {i + 8}, {i + 15}, {i + 22}</span></li>{/each}</ul>
      </section>
    {/if}
    {#if layerData.layers.length}
      <div class="seasonEvents" aria-live="polite">
        {#each layerData.layers as layer (layer.id)}
          <section class="eventGroup" aria-label={layer.label}>
            <h2>{layer.description}</h2>
            {#if !layer.available}
              <p>{layer.label} unavailable for this period. Supported Gregorian years: {layer.supportedYears.join('–')}.</p>
            {:else if !layer.events.length}
              <p>No events in this period.</p>
            {:else}
              <ul>{#each layer.events as event (event.id)}<li><span class="eventBullet" title={calendarEventDetails(event, timezone)}>{calendarEventMarker(event)}</span><span><strong>{event.label}</strong> · {civilLabel(event.day, true)} · ≈ {new Intl.DateTimeFormat('en-GB', {timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(event.ts)} ({timezone})</span></li>{/each}</ul>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
    <footer>
      <span class="timezone">Today · {timezone}</span>
    </footer>
  {/if}
</section>

<DocsModal open={$docsState.open} title={$docsState.title}
  md={$docsState.loading ? '# Loading…' : $docsState.md}
  url={$docsState.url} onClose={docs.closeDocs} />

<style>
  .eventMarkers { position: absolute; top: 3px; right: 4px; display: flex; flex-direction: column; gap: 1px; }
  .lunarMarkers { right: auto; left: 4px; }
  .bindMarkers { top: auto; bottom: 3px; }
  .eventMarker { font-size: 12px; line-height: 1.2; white-space: nowrap; cursor: help; }
  .seasonEvents { margin-top: 20px; font-size: 14px; }
  .seasonEvents p { color: var(--muted); }
  .eventGroup + .eventGroup { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--panel-border); }
  .eventGroup h2 { margin: 0 0 8px; font-size: 14px; font-weight: 600; }
  .seasonEvents ul { padding: 0; list-style: none; line-height: 1.7; }
  .seasonEvents li { display: flex; align-items: baseline; gap: 8px; margin: 6px 0; }
  .eventBullet { white-space: nowrap; min-width: 2.7em; cursor: help; }
  .calendarTitle { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .calendarTitle .eyebrow { margin: 0; }
  .calendarTitle .infoButton { width: 28px; height: 28px; min-height: 28px; padding: 0; border-radius: 50%; font-family: Georgia, serif; font-weight: 700; }

  .calendar { max-width: 1000px; margin: 24px auto; padding: clamp(16px, 3vw, 32px); border: 1px solid var(--panel-border); border-radius: 20px; background: var(--panel); }
  .heading { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 16px; }
  .todayButton { justify-self: end; }
  .displayOptions { justify-self: center; }
  .displayOptions :global(.calendarOptionsButton) { display: flex; align-items: center; min-height: 44px; padding: 8px 12px; font: inherit; color: var(--fg); background: var(--btn-bg); border: 1px solid var(--btn-border); border-radius: 9px; cursor: pointer; }
  .displayOptions :global(.calendarOptionsButton:focus-visible) { outline: 2px solid var(--accent-blue); outline-offset: 3px; }
  .displayOptions :global(.db-caret) { font-size: 16px; }
  .eyebrow { font-size: 12px; letter-spacing: .16em; opacity: .65; margin: 0 0 8px; }
  h1 { margin: 0; font-size: clamp(24px, 4vw, 36px); font-weight: 650; }
  .coordinate { font-size: 14px; opacity: .75; margin: 12px 0 24px; }
  button, select, input { font: inherit; color: var(--fg); }
  button, select, input[type=number] { background: var(--btn-bg, var(--bg)); border: 1px solid var(--panel-border); border-radius: 9px; min-height: 44px; padding: 8px 12px; }
  button { cursor: pointer; }
  button:hover { border-color: var(--fg); }
  :is(button, select, input):focus-visible { outline: 2px solid #709be8; outline-offset: 3px; }
  .selectors { display: grid; grid-template-columns: 1.2fr 1fr 1fr .8fr 1.5fr auto; gap: 10px; align-items: end; }
  .selectors.gregorianSelectors { grid-template-columns: .8fr 1fr 1.5fr 1fr auto; }
  .weekBullet { display: inline-block; width: 12px; height: 12px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--panel-border); }
  .weekday { text-align: center; font-size: 13px; color: var(--muted); padding-bottom: 4px; }
  .epochRange { overflow-wrap: anywhere; }
  .selectors label { display: grid; gap: 6px; font-size: 14px; min-width: 0; }
  .selectors select, .selectors input { width: 100%; box-sizing: border-box; }
  .navigation { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 24px 0 18px; }
  .navigation button { width: 48px; flex-shrink: 0; font-size: 22px; }
  .periodMeta { text-align: center; display: grid; gap: 5px; }
  small { font-size: 13px; opacity: .7; }
  .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
  .day { position: relative; min-height: 92px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; border: 1px solid var(--panel-border); border-radius: 10px; background: var(--day-color); }
  .dayNumber { font-size: 24px; font-variant-numeric: tabular-nums; }
  .civil { font-size: 13px; opacity: .7; }
  .today { border: 2px solid #709be8; box-shadow: inset 0 0 0 1px var(--fg); }
  .todayDot { width: 5px; height: 5px; border-radius: 50%; background: #709be8; position: absolute; bottom: 8px; }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 24px; flex-wrap: wrap; font-size: 14px; }
  .timezone { opacity: .6; font-size: 12px; }
  .error { color: #e17777; }
  @media(max-width: 640px) {
    .heading { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
    .displayOptions { grid-column: 1 / -1; grid-row: 2; }
    .todayButton { grid-column: 2; grid-row: 1; }
    .calendar { margin: 10px auto; padding: 14px; }
    .selectors { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .selectors.gregorianSelectors { grid-template-columns: .8fr 1fr 1.4fr; }
    .selectors.gregorianSelectors button { grid-column: 1 / -1; }
    .selectors :is(select,input,button) { padding: 8px 6px; }
    .days { gap: 4px; }
    .day { min-height: 68px; gap: 4px; border-radius: 7px; }
    .dayNumber { font-size: 20px; }
    .civil { font-size: 12px; }
    .todayDot { bottom: 4px; }
    footer { gap: 4px; margin-top: 16px; }
  }
</style>
