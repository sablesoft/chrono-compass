import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import Ajv2020 from 'ajv/dist/2020.js';
const dir = await mkdtemp(join(tmpdir(), 'moment-api-'));
let server;
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
try {
  await build({configFile: false, publicDir: false, logLevel: 'silent', build: {ssr: 'scripts/moment-api-fixture.ts', outDir: dir, emptyOutDir: false, rollupOptions: {external: ['@js-temporal/polyfill'], output: {entryFileNames: 'fixture.mjs'}}}});
  // Resolve runtime dependencies from the repository rather than the temporary directory.
  const source = await readFile(join(dir, 'fixture.mjs'), 'utf8');
  const runtime = pathToFileURL(join(process.cwd(), 'node_modules/@js-temporal/polyfill/dist/index.esm.js')).href;
  await writeFile(join(dir, 'fixture.mjs'), source.replaceAll('"@js-temporal/polyfill"', JSON.stringify(runtime)).replaceAll("'@js-temporal/polyfill'", JSON.stringify(runtime)).replaceAll('"astronomy-engine"', JSON.stringify(pathToFileURL(join(process.cwd(), 'node_modules/astronomy-engine/esm/astronomy.js')).href)));
  const f = await import(pathToFileURL(join(dir, 'fixture.mjs')).href);
  const ajv = new Ajv2020({strict: false, validateFormats: false});
  const validate = name => ajv.compile({$ref: '#/components/schemas/' + name, components: f.openapi.components});
  const validators = Object.fromEntries(['Moment','Range','Year','CycleRegistry','Error'].map(name=>[name,validate(name)]));
  const conforms = (name, value) => assert.ok(validators[name](value), JSON.stringify(validators[name].errors));
  const call = (path, clock) => f.queryApi(new URL(path, 'http://localhost'), clock);
  const seconds = Date.UTC(2026, 10, 24, 0, 30) / 1000;
  check('defaults capture the server clock exactly once; explicit timestamp does not read the clock', () => {
    let count = 0;
    const v = call('/api/v1/moment', () => {count++; return seconds * 1000;});
    assert.equal(count, 1); assert.equal(v.timestamp, seconds); assert.equal(v.timezone, 'UTC'); assert.ok(!('cycles' in v));
    assert.equal(call(`/api/v1/moment?timestamp=${seconds}`, () => {throw Error('clock');}).timestamp, seconds);
  });
  check('timestamp/timezone combinations, fractional and negative seconds, local midnight', () => {
    const utc = call(`/api/v1/moment?timestamp=${seconds}`);
    const br = call(`/api/v1/moment?timestamp=${seconds}&timezone=America/Sao_Paulo`);
    assert.equal(utc.timestamp, br.timestamp); assert.equal(utc.local.date, '2026-11-24'); assert.equal(br.local.date, '2026-11-23');
    assert.equal(call('/api/v1/moment?timezone=America/Sao_Paulo', () => seconds * 1000).local.date, br.local.date);
    assert.equal(call('/api/v1/moment?timestamp=-0.001').utcDatetime, '1969-12-31T23:59:59.999Z');
    assert.equal(call('/api/v1/moment?timestamp=0').utcDatetime, '1970-01-01T00:00:00.000Z');
  });
  check('calendar parity with UI civilDayAt/fromDay/notation at every date in an entire leap cycle', () => {
    for (let y = 2024; y <= 2027; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
      const ts = Date.UTC(y, m - 1, d, 0, 30);
      for (const tz of ['UTC', 'America/Sao_Paulo']) {
        const expected = f.fromDay(f.civilDayAt(ts, tz) - f.CALENDAR_EPOCH_DAY);
        assert.equal(f.harmonicAt(ts, tz).notation, f.notation(expected));
      }
    }
  });
  check('all month, week, free-day, year, X, age and Great Cycle boundaries', () => {
    for (const day of [-1, 0, 1, 2, 3, 4, 10, 11, 31, 32, 367, 368, 369, f.DAYS_PER_GC - 1, f.DAYS_PER_GC]) {
      const h = f.harmonicAt((f.CALENDAR_EPOCH_DAY + day) * 86400000, 'UTC'), expected = f.fromDay(day);
      assert.equal(h.notation, f.notation(expected));
      assert.equal(h.isDayOutOfTime, expected.moon === 14);
      if (expected.moon === 14) {assert.equal(h.month, null); assert.equal(h.day, null); assert.equal(h.week, null);}
      else {assert.equal(h.month.number, expected.moon); assert.equal(h.isEndOfWeek, expected.day % 7 === 0);}
      assert.equal(h.isEndOfYear, day === f.yearStart(expected) + 363 + f.correctionDays(expected));
      const periods = f.calendarPeriods(expected);
      for (const p of Object.values(periods)) assert.ok(p.start <= day && day < p.end);
    }
    const initial = call(`/api/v1/year?gc=1&age=1&wave=0&year=1`);
    assert.equal(initial.calendarDays, 364); assert.equal(initial.samples.length, 364); assert.equal(initial.freeDays.length, 4);
    assert.equal(initial.freeDays[0].harmonic.freeDay.label, 'S1');
    assert.equal(initial.freeDays[3].harmonic.freeDay.label, 'S4'); assert.equal(initial.samples[0].harmonic.month.number, 1);
    const regular = call('/api/v1/year?gc=1&age=1&wave=1&year=1');
    assert.equal(regular.calendarDays, 364); assert.equal(regular.freeDays.length, 1); assert.equal(regular.freeDays[0].harmonic.freeDay.label, 'S');
    assert.ok(regular.samples.at(-1).harmonic.isEndOfYear);
  });
  check('compact defaults, opt-in labels, explicit wave/X year coordinates and yearly ordinals', () => {
    const path = '/api/v1/moment?timestamp=1795564800';
    const compact = call(path), verbose = call(path + '&labels=true');
    assert.deepEqual(call(path + '&labels=false'), compact);
    const h = compact.harmonic;
    assert.deepEqual(h.year, {yearInWave: 5, yearInX: null, correctionDays: 1});
    assert.deepEqual(h.wave, {number: 13, isX: false});
    assert.deepEqual(h.day, {number: 4, weekday: 4, dayOfYear: 340});
    assert.deepEqual(h.week, {number: 1, weekOfYear: 49});
    assert.deepEqual(h.month, {number: 13});
    assert.equal(verbose.harmonic.day.symbolicName, 'Heart');
    assert.equal(verbose.harmonic.month.name, 'Cosmic');
    assert.equal(verbose.harmonic.year.name, 'Overtone');
    assert.equal(verbose.harmonic.wave.label, '13');
    assert.equal(verbose.harmonic.week.name, 'Initiate');
    assert.equal(verbose.harmonic.week.direction, 'East');
    const x = call('/api/v1/year?gc=1&age=1&wave=0&year=1&labels=true');
    assert.deepEqual(x.samples[0].harmonic.wave, {number: null, isX: true, label: 'X'});
    assert.equal(x.samples[0].harmonic.year.yearInWave, null);
    assert.equal(x.samples[0].harmonic.year.yearInX, 1);
    assert.equal(x.samples[0].harmonic.day.dayOfYear, 1);
    assert.equal(x.samples.at(-1).harmonic.day.dayOfYear, 364);
    assert.equal(x.samples.at(-1).harmonic.week.weekOfYear, 52);
    const range = call('/api/v1/range?start=1795564800&end=1795564802&step=1&labels=true');
    assert.ok(range.samples.every(s => s.harmonic.day.symbolicName === 'Heart'));
    for (const {skipped, ...sample} of [...x.samples, ...x.freeDays]) conforms('Moment', sample);
    conforms('Moment', verbose); conforms('Year', x); conforms('Range', range);
  });
  check('364-day calendar boundaries exclude preceding free days for ordinary and four-day periods', () => {
    for (const coords of ['gc=1&age=1&wave=0&year=1', 'gc=1&age=1&wave=1&year=1', 'gc=1&age=15&wave=13&year=5']) {
      const y = call('/api/v1/year?' + coords);
      assert.equal(y.samples.length, 364);
      const first = y.samples[0], last = y.samples.at(-1), bounds = first.harmonic.boundaries.year;
      assert.equal(bounds.startTimestamp, first.timestamp);
      assert.equal(bounds.endTimestampExclusive, last.harmonic.boundaries.day.endTimestampExclusive);
      assert.equal((bounds.endTimestampExclusive - bounds.startTimestamp) / 86400, 364);
      for (const [i, sample] of y.samples.entries()) {
        const h = sample.harmonic;
        assert.equal(h.day.dayOfYear, i + 1);
        assert.equal(h.week.weekOfYear, Math.floor(i / 7) + 1);
        assert.equal(h.isEndOfYear, i === 363);
        assert.equal(h.isDayOutOfTime, false);
        assert.deepEqual(h.boundaries.year, bounds);
        for (const period of Object.values(h.boundaries)) if (period) assert.ok(!('calendarDays' in period));
      }
      for (const sample of y.freeDays) {
        const h = sample.harmonic;
        assert.equal(h.boundaries.year, null); assert.equal(h.month, null); assert.equal(h.day, null); assert.equal(h.week, null);
        assert.ok(h.boundaries.freePeriod.startTimestamp <= sample.timestamp);
        assert.ok(sample.timestamp < bounds.startTimestamp);
        assert.ok(!h.isEndOfYear);
        assert.equal(h.boundaries.freePeriod.endTimestampExclusive, bounds.startTimestamp);
        for (const period of Object.values(h.boundaries)) if (period) assert.ok(!('calendarDays' in period));
        assert.deepEqual(call('/api/v1/year?timestamp=' + sample.timestamp), y);
      }
    }
  });
  check('DST gaps, folds, historical offsets and a skipped civil date', () => {
    for (const [y, m, d, hours] of [[2026, 3, 8, 23], [2026, 11, 1, 25]]) {
      const start = f.gregorianDay(y, m, d);
      assert.equal((f.dayStart(start + 1, 'America/New_York') - f.dayStart(start, 'America/New_York')) / 3600000, hours);
    }
    const sao = call(`/api/v1/moment?timestamp=${Date.UTC(2018,10,4,4)/1000}&timezone=America/Sao_Paulo`);
    assert.equal(sao.harmonic.boundaries.day.startTimestamp, Date.UTC(2018,10,4,3)/1000);
    const old = call(`/api/v1/moment?timestamp=${Date.UTC(1880,0,1,12)/1000}&timezone=America/New_York`);
    assert.equal(old.local.offset, '-04:56:02');
    const year = call(`/api/v1/year?timestamp=${Date.UTC(2011,11,31)/1000}&timezone=Pacific/Apia`);
    assert.ok(year.samples.some(s => s.skipped && s.gregorian.year === 2011 && s.gregorian.month === 12 && s.gregorian.day === 30));
  });
  check('range is half-open with elapsed-second steps; bounded resource use and explicit year coordinates', () => {
    const v = call('/api/v1/range?start=0&end=3&step=1'); assert.deepEqual(v.samples.map(s => s.timestamp), [0,1,2]);
    assert.deepEqual(call('/api/v1/range?start=0&end=3&step=1.001').samples.map(s=>s.timestamp), [0,1.001,2.002]);
    assert.throws(() => call('/api/v1/range?start=0&end=1000&step=1'));
    assert.throws(() => call('/api/v1/year?gc=1'));
    assert.throws(() => call('/api/v1/year?gc=1&age=1&wave=14&year=1'));
  });
  check('invalid parameters, unknown cycles, milliseconds, date bounds and prototype identifiers', () => {
    for (const query of ['timestamp=', 'timestamp=NaN','timestamp=Infinity','timestamp=1e9','timestamp=1795521600000','timestamp=1.0001', 'timestamp=1&timestamp=2','timezone=bad','timezone=%2B03:00','include=', 'include=constructor','include=moon,moon','include=__proto__','foo=1','latitude=0','include=diurnal','include=diurnal&latitude=91&longitude=0','include=plato&looker=Earth','labels=','labels=1','labels=True','labels=false&labels=true']) {
      assert.throws(() => call('/api/v1/moment?' + query), e => e.status === 400, query);
    }
    assert.equal(call('/api/v1/moment?timestamp=0&include=moon').timestamp, 0);
    assert.equal(call('/api/v1/moment?timestamp=1795521600&include=diurnal&latitude=-23.55052&longitude=-46.633308').cycles.diurnal.status, 'available');
  });
  check('OpenAPI response schemas: ordinary/free moments, range, full year and registry', () => {
    conforms('Moment',call('/api/v1/moment?timestamp=1795521600'));
    conforms('Moment',call('/api/v1/moment?timestamp='+f.CALENDAR_EPOCH_DAY*86400));
    conforms('Range',call('/api/v1/range?start=0&end=3&step=1'));
    conforms('Year',call('/api/v1/year?gc=1&age=1&wave=0&year=1'));
    conforms('CycleRegistry',call('/api/v1/cycles'));
  });
  const date = Date.UTC(2026, 5, 21, 12), uri = `/api/v1/moment?timestamp=${date/1000}`;
  const expectedSolvers = [
    ['moon', f.solveSynodWheel({wheelType:'synod',looker:'Sun',focus:'Earth',target:'Moon',ts:date})],
    ['solar', f.solveSeasonWheel({wheelType:'season',focus:'Sun',target:'Earth',ts:date})],
    ['lunar_draconic', f.solveNodalWheel({wheelType:'nodal',looker:'Sun',focus:'Earth',target:'Moon',ts:date})],
    ['solar_anomalistic', f.solveBindWheel({wheelType:'bind',focus:'Sun',target:'Earth',meta:f.bind.roles.find(r=>r.target[0]==='Earth').meta,ts:date})]
  ];
  check('astronomical parity: exact solver spokes for moon, solar, anomalistic and draconic cycles', () => {
    const v = call(uri + '&include=' + expectedSolvers.map(([id])=>id).join(','));
    for (const [id, solved] of expectedSolvers) {
      assert.ok(solved.ok, id); assert.equal(v.cycles[id].status, 'available');
      assert.deepEqual(v.cycles[id].spokes.map(s=>s.timestamp), solved.spokes.map(s=>s.ts/1000));
    }
    assert.equal(new Date(v.cycles.solar.spokes.find(s=>s.code==='N').timestamp*1000).getUTCMonth(), 5);
    assert.equal(v.cycles.moon.spokes.length,17);
  });
  check('all registry cycles use one timestamp, stable IDs, deterministic results', () => {
    const registry = call('/api/v1/cycles'); assert.equal(new Set(registry.cycles.map(c=>c.id)).size, registry.cycles.length);
    for (const {id} of registry.cycles) {
      const query = uri + '&include=' + id + (id==='diurnal' ? '&latitude=0&longitude=0' : '');
      const started = performance.now();
      const a = call(query), b = call(query); conforms('Moment', a);
      console.log(`  ${id}: ${(performance.now()-started).toFixed(0)}ms for two evaluations (${a.cycles[id].status})`); assert.deepEqual(a,b,id);
      assert.equal(a.timestamp, date/1000); assert.ok(['available','unavailable'].includes(a.cycles[id].status), id);
      if (id === 'plato') assert.equal(a.cycles[id].status, 'available');
      if (a.cycles[id].status==='available' && a.cycles[id].spokes) {
        assert.ok(a.cycles[id].startTimestamp <= date/1000 + 60, id);
        assert.ok(a.cycles[id].endTimestampExclusive > date/1000 - 60, id);
      }
    }
    assert.throws(()=>call('/api/v1/moment?timestamp=-200000000000&include=moon'),e=>e.status===422);
  });
  // HTTP tests use an ephemeral loopback port and the actual compiled production server.
  const probe = createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening'); const port = probe.address().port; await new Promise(r=>probe.close(r));
  const launch = async (extra={}) => {
    server = spawn(process.execPath,['dist-ssr/index.js'],{env:{...process.env, PORT:String(port), HOST:'127.0.0.1',API_RATE_LIMIT:'60',API_CORS_ORIGINS:'https://allowed.example',...extra},stdio:['ignore','pipe','pipe']});
    let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
    for(let i=0;i<100;i++) {if(logs.includes('HTTP server ready')) return; if(server.exitCode!==null) throw Error(logs); await new Promise(r=>setTimeout(r,50));} throw Error(logs);
  };
  const stop = async()=>{const p=server;server=undefined;p.kill('SIGTERM');await once(p,'exit');};
  const http=(path,init)=>fetch(`http://127.0.0.1:${port}${path}`,init);
  await launch();
  let res=await http('/api/v1/moment');assert.equal(res.status,200);let json=await res.json();assert.equal(json.timezone,'UTC');assert.ok(Math.abs(json.timestamp-Date.now()/1000)<5);
  res=await http(uri+'&labels=true');assert.equal(res.status,200);json=await res.json();assert.ok('name' in json.harmonic.month);
  assert.equal((await http(uri+'&labels=invalid')).status,400);
  res=await http(uri+'&include=moon,solar');assert.equal(res.status,200);assert.ok((await res.json()).cycles.moon);
  res=await http('/api/v1/moment?foo=1');assert.equal(res.status,400);assert.equal(res.headers.get('cache-control'),'no-store');conforms('Error',await res.json());
  assert.equal((await http('/api/v1/nope')).status,404);assert.equal((await http('/api/v2/moment')).status,404);
  assert.equal((await http('/api/v1/moment',{method:'POST'})).status,405);
  res=await http(uri,{headers:{Origin:'https://allowed.example'}});assert.equal(res.headers.get('access-control-allow-origin'),'https://allowed.example');
  assert.equal((await http(uri,{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await http(uri,{method:'OPTIONS',headers:{Origin:'https://allowed.example'}})).status,204);
  for (const [path, schema] of [['/api/v1/range?start=0&end=3&step=1','Range'],['/api/v1/year?timestamp=1795521600','Year'],['/api/v1/cycles','CycleRegistry']]) {res=await http(path);assert.equal(res.status,200);conforms(schema,await res.json());}
  res=await http('/api/v1/openapi.json');assert.equal(res.status,200);assert.deepEqual(await res.json(),f.openapi);
  assert.equal((await http('/healthz')).status,200);res=await http('/');assert.match(res.headers.get('content-type'),/text\/html/);
  assert.equal((await http('/assets/missing.js')).status,404);assert.equal((await http('/.env')).status,404);
  const before=await (await http(uri)).json();await stop();await launch();assert.deepEqual(await (await http(uri)).json(),before);
  await stop();await launch({API_RATE_LIMIT:'1'});assert.equal((await http(uri)).status,200);res=await http(uri,{headers:{'X-Forwarded-For':'spoofed'}});assert.equal(res.status,429);assert.ok(res.headers.get('retry-after'));
  await stop();await launch({API_WORKERS:'1',API_COMPUTE_TIMEOUT_MS:'1000'});
  const pending = http(uri+'&include=pluto_nodal');
  await new Promise(r=>setTimeout(r,25));
  res=await http(uri);assert.equal(res.status,503);assert.equal((await res.json()).error.code,'busy');
  assert.equal((await http('/healthz')).status,200);
  res=await pending;assert.equal(res.status,503);assert.equal((await res.json()).error.code,'calculation_timeout');
  assert.equal((await http('/healthz')).status,200);
  assert.equal((await http(uri)).status,200);
  checks++;console.log('PASS real HTTP: defaults, errors, CORS, methods, OpenAPI, static site, restart, rate limiting, spoof rejection and worker timeout');
  await mkdir('tmp',{recursive:true});
  await writeFile('tmp/moment-example.json',JSON.stringify(call(uri+'&include=moon,solar,harmonic_long_cycles'),null,2)+'\n');
  const examples = {utc: call('/api/v1/moment?timestamp=1795521600'), saoPaulo: call('/api/v1/moment?timestamp=1795521600&timezone=America/Sao_Paulo'), freeDay: call('/api/v1/moment?timestamp='+f.CALENDAR_EPOCH_DAY*86400), labels: call('/api/v1/moment?timestamp=1795564800&labels=true'), cycles: call('/api/v1/moment?timestamp=1795521600&include=moon,solar,harmonic_long_cycles')};
  for (const example of Object.values(examples)) conforms('Moment',example);
  await writeFile('docs/moment-api.examples.json',JSON.stringify(examples,null,2)+'\n');
  console.log(`Moment API: ${checks} groups passed.`);
} finally {
  if(server){server.kill('SIGTERM');await once(server,'exit');}
  await rm(dir,{recursive:true,force:true});
}
