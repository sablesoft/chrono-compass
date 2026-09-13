import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'calendar-events-'));
try {
  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: dir, emptyOutDir: false, minify: false,
    lib: {entry: 'src/lib/calendar/seasonEvents.ts', formats: ['es'], fileName: () => 'events.mjs'}
  }});
  const {seasonEvents, civilDayAt, calendarEventDetails, calendarEventMarker} = await import(pathToFileURL(join(dir, 'events.mjs')).href);
  const day = (month, date) => Date.UTC(2026, month - 1, date) / 86400000;
  const {events, available} = seasonEvents(day(1, 1), day(12, 31), 0, 'UTC');
  assert.equal(available, true);
  assert.deepEqual(events.map(e => e.label), ['March equinox', 'June solstice', 'September equinox', 'December solstice']);
  assert.equal(new Set(events.map(e => e.id)).size, 4);
  assert.deepEqual(events.map(e => e.direction), ['E', 'N', 'W', 'S']);
  const details = calendarEventDetails(events[0], 'America/Sao_Paulo');
  assert.ok(details.includes('March equinox (E)'));
  assert.ok(details.includes('America/Sao_Paulo'));
  assert.ok(details.includes('UTC'));
  assert.ok(details.includes('Approximate'));
  for (const e of events) {
    assert.equal(e.day, Math.floor(e.ts / 86400000));
    assert.equal(seasonEvents(e.day, e.day, 0, 'UTC').events.length, 1);
  }
  const shifted = seasonEvents(day(1, 1) - 1234, day(12, 31) - 1234, 1234, 'UTC').events;
  assert.deepEqual(shifted.map(e => e.day), events.map(e => e.day - 1234));
  assert.equal(seasonEvents(-921517, -921490, 0, 'UTC').available, false);
  const midnight = Date.UTC(2026, 2, 20, 0, 30);
  assert.equal(civilDayAt(midnight, 'America/Sao_Paulo'), day(3, 19));
  assert.equal(civilDayAt(midnight, 'Pacific/Kiritimati'), day(3, 20));
  for (const tz of ['America/Sao_Paulo', 'Pacific/Kiritimati']) {
    for (const e of seasonEvents(day(1, 1), day(12, 31), 0, tz).events) assert.equal(e.day, civilDayAt(e.ts, tz));
  }
  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: dir, emptyOutDir: false, minify: false,
    lib: {entry: 'src/lib/calendar/bindEvents.ts', formats: ['es'], fileName: () => 'bind.mjs'}
  }});
  const {bindEvents} = await import(pathToFileURL(join(dir, 'bind.mjs')).href);
  const bind = bindEvents(day(1, 1), day(12, 31), 0, 'UTC');
  assert.equal(bind.available, true);
  assert.equal(bind.events.length, 4);
  assert.deepEqual(bind.events.map(e => e.direction), ['S', 'E', 'N', 'W']);
  assert.ok(bind.events.every(e => e.icon === '🌍'));
  assert.equal(new Set(bind.events.map(e => e.id)).size, 4);
  assert.equal(new Date(bind.events.find(e => e.direction === 'S').ts).getUTCMonth(), 0);
  assert.equal(new Date(bind.events.find(e => e.direction === 'N').ts).getUTCMonth(), 6);
  for (const e of bind.events) {
    assert.equal(bindEvents(e.day, e.day, 0, 'UTC').events.length, 1);
    assert.equal(e.day, civilDayAt(e.ts, 'UTC'));
    assert.ok(calendarEventDetails(e, 'UTC').includes('Sun Bind: Earth'));
  }
  assert.deepEqual(bindEvents(day(1, 1) - 1234, day(12, 31) - 1234, 1234, 'UTC').events.map(e => e.day), bind.events.map(e => e.day - 1234));
  assert.equal(bindEvents(-921517, -921490, 0, 'UTC').available, false);
  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: dir, emptyOutDir: false, minify: false,
    lib: {entry: 'src/lib/calendar/lunarEvents.ts', formats: ['es'], fileName: () => 'lunar.mjs'}
  }});
  const {lunarEvents} = await import(pathToFileURL(join(dir, 'lunar.mjs')).href);
  const lunar = lunarEvents(day(3, 1), day(3, 31), 0, 'UTC');
  assert.equal(lunar.available, true);
  assert.equal(lunar.events.length, 4);
  assert.deepEqual(lunar.events.map(e => e.direction), ['N', 'W', 'S', 'E']);
  assert.deepEqual(lunar.events.map(calendarEventMarker), ['🌕', '🌗', '🌑', '🌓']);
  assert.equal(calendarEventMarker(bind.events[0]), '🌍S');
  assert.equal(calendarEventMarker(events[0]), '☀E');
  for (const e of lunar.events) {
    assert.equal(e.ts % 60000, 0);
    assert.equal(lunarEvents(e.day, e.day, 0, 'UTC').events.length, 1);
  }
  const split = [...lunarEvents(day(3, 1), day(3, 15), 0, 'UTC').events, ...lunarEvents(day(3, 16), day(3, 31), 0, 'UTC').events];
  assert.deepEqual(split.map(e => e.id), lunar.events.map(e => e.id));
  for (const tz of ['America/Sao_Paulo', 'Pacific/Kiritimati']) {
    for (const e of lunarEvents(day(3, 1), day(3, 31), 0, tz).events) assert.equal(e.day, civilDayAt(e.ts, tz));
  }
  assert.equal(lunarEvents(-921517, -921490, 0, 'UTC').available, false);
  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: dir, emptyOutDir: false, minify: false,
    lib: {entry: 'src/lib/calendar/layers.ts', formats: ['es'], fileName: () => 'layers.mjs'}
  }});
  const {DISPLAY_OPTIONS, GREGORIAN_DISPLAY_OPTIONS, readDisplayOptions, saveDisplayOptions, resolveCalendarLayers} = await import(pathToFileURL(join(dir, 'layers.mjs')).href);
  const values = new Map([['chrono-calendar-gregorian', 'true'], ['chrono-calendar-bind', 'true']]);
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  assert.deepEqual(readDisplayOptions(storage), ['gregorian', 'bind']);
  saveDisplayOptions(storage, ['season', 'lunar']);
  assert.deepEqual(readDisplayOptions(storage), ['season', 'lunar']);
  assert.equal(values.get('chrono-calendar-bind'), 'false');
  assert.equal(new Set(DISPLAY_OPTIONS.map(o => o.value)).size, DISPLAY_OPTIONS.length);
  assert.deepEqual(resolveCalendarLayers(['gregorian'], day(3, 1), day(3, 31), 0, 'UTC'), {layers: [], events: []});
  const combined = resolveCalendarLayers(['season', 'lunar'], day(3, 1), day(3, 31), 0, 'UTC');
  assert.equal(combined.layers.length, 2);
  assert.equal(combined.events.length, 5);
  assert.ok(combined.events.filter(e => e.layerId === 'lunar').every(e => e.corner === 'top-left'));
  assert.ok(combined.events.filter(e => e.layerId === 'season').every(e => e.corner === 'top-right'));
  saveDisplayOptions(storage, ['epoch', 'bind'], GREGORIAN_DISPLAY_OPTIONS);
  assert.deepEqual(readDisplayOptions(storage, GREGORIAN_DISPLAY_OPTIONS), ['epoch', 'bind']);
  assert.deepEqual(readDisplayOptions(storage), ['bind']);
  saveDisplayOptions(storage, ['gregorian', 'season']);
  assert.deepEqual(readDisplayOptions(storage, GREGORIAN_DISPLAY_OPTIONS), ['epoch', 'season']);

  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: dir, emptyOutDir: false, minify: false,
    lib: {entry: 'src/lib/calendar/gregorian.ts', formats: ['es'], fileName: () => 'gregorian.mjs'}
  }});
  const {gregorianMonth, moveGregorianMonth, epochDayLabel} = await import(pathToFileURL(join(dir, 'gregorian.mjs')).href);
  // Compare every month in a full Gregorian leap cycle against the platform date implementation.
  for (let y = 1600; y < 2000; y++) for (let m = 1; m <= 12; m++) {
    const grid = gregorianMonth({year: y, month: m}, 0);
    assert.equal(grid.days.length, new Date(Date.UTC(y, m, 0)).getUTCDate());
    assert.equal(grid.offset, (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7);
    const sundayGrid = gregorianMonth({year: y, month: m}, 0, 'Sun');
    assert.equal(sundayGrid.offset, new Date(Date.UTC(y, m - 1, 1)).getUTCDay());
    assert.deepEqual(sundayGrid.days, grid.days);
    assert.equal(grid.days[0].absolute, Date.UTC(y, m - 1, 1) / 86400000);
    assert.deepEqual(moveGregorianMonth(moveGregorianMonth({year: y, month: m}, 1), -1), {year: y, month: m});
  }
  assert.deepEqual(moveGregorianMonth({year: 1, month: 1}, -1), {year: 0, month: 12});
  assert.deepEqual(moveGregorianMonth({year: 0, month: 12}, 1), {year: 1, month: 1});
  assert.equal(gregorianMonth({year: 0, month: 2}, 0).days.length, 29);
  assert.throws(() => gregorianMonth({year: 10000, month: 1}, 0));
  assert.throws(() => gregorianMonth({year: 2026, month: 13}, 0));
  assert.equal(epochDayLabel(0), 'S1');
  assert.equal(epochDayLabel(3), 'S4');
  assert.equal(epochDayLabel(4), 'M1 · 1');
  assert.equal(epochDayLabel(368), 'S');
  const gregorianMarch = gregorianMonth({year: 2026, month: 3}, 1234);
  const gregorianEvents = resolveCalendarLayers(['season', 'lunar'], gregorianMarch.days[0].absolute, gregorianMarch.days.at(-1).absolute, 1234, 'UTC');
  assert.deepEqual(gregorianEvents.events.map(e => e.id), combined.events.map(e => e.id));
  assert.deepEqual(gregorianEvents.events.map(e => e.day), combined.events.map(e => e.day - 1234));
  console.log('Gregorian checks passed: 400-year weekday/leap cycle, BCE navigation, Epoch labels, shared layers and independent date preferences.');
  console.log('Layer registry checks passed: legacy preferences, independent selection and marker positions.');
  console.log('Lunar adapter checks passed: four phases, minute precision, stable page boundaries, time zones and marker icons.');
  console.log('Bind adapter checks passed: four primary events, Earth icons, perihelion/aphelion, date boundaries and offsets.');
  console.log('Season adapter checks passed: four unique events, day filters, epoch offsets, time zones, unsupported dates.');
} finally { await rm(dir, {recursive: true, force: true}); }
