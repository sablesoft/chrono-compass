import assert from 'node:assert/strict';
import { build } from 'vite';
import { fromDay, gregorianDay } from '../src/lib/calendar/core.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'calendar-print-'));
try {
  await build({configFile:false,logLevel:'silent',build:{outDir:dir,lib:{entry:'src/lib/calendar/print.ts',formats:['es'],fileName:()=> 'print.mjs'}}});
  const {printPeriods,buildPrintDocument} = await import(pathToFileURL(join(dir,'print.mjs')).href);
  for (const year of [{gc:1,phrase:1,wave:0,year:1},{gc:1,phrase:1,wave:1,year:1},{gc:1,phrase:1,wave:1,year:12},{gc:0,phrase:122,wave:0,year:4}]) {
    const start = printPeriods(year,'start'), end = printPeriods(year,'end'), both = printPeriods(year,'both');
    assert.equal(start[0].moon,14); assert.equal(end[13].moon,14);
    assert.equal(start[0].days.at(-1).absolute + 1, start[1].days[0].absolute);
    assert.equal(end[12].days.at(-1).absolute + 1, end[13].days[0].absolute);
    assert.deepEqual(both[0], start[0]); assert.deepEqual(both.at(-1), end.at(-1));
    assert.notDeepEqual(start[0].year, end[13].year);
    if (year.gc === 1 && year.phrase === 1 && year.wave === 1 && year.year === 12) {
      assert.equal(start[0].days.length, 1);
      assert.equal(end[13].days.length, 4);
    }
    for (const periods of [start, end, both]) {
      const days = periods.flatMap(p=>p.days.map(d=>d.absolute));
      assert.equal(new Set(days).size, days.length);
    }
    const opts = {year,epoch:-921517,timezone:'UTC',latitude:0,selected:[],language:'en',freeDays:'end'};
    const html = buildPrintDocument(opts);
    assert.equal((html.match(/class="page /g)||[]).length,30);
    assert.ok(html.includes('</section><section class="page back blank"></section>'));
    assert.equal((html.match(/class="page front"/g)||[]).length,15);
    assert.equal((html.match(/class="page back/g)||[]).length,15);
    assert.ok(!html.includes('<h2>Chakras</h2>'));
    assert.ok(html.includes('Harmonic Calendar'));
    const cover = html.match(/<div class="cover">[\s\S]*?<\/div>/)?.[0] || '';
    assert.ok(cover.includes('UTC'));
    assert.ok(cover.includes('https://chrono-compass.app'));
    assert.ok(!cover.includes('Free Days at'));
    assert.ok(!html.includes('Special days &amp; reading the grid'));
    assert.ok(!html.includes('Weeks 1–4'));
    assert.ok(!html.includes('Grid dates: day.month.year'));
    const ru = buildPrintDocument({...opts,language:'ru',selected:['gregorian','chakras','dreamspell','season','bind','lunar']});
    for (const label of ['Гармоничный Календарь','Григорианские даты','Dreamspell','Сезонные события','Расстояние Земля–Солнце','Фазы Луны','Недоступно']) assert.ok(ru.includes(label),label);
    assert.ok(!ru.includes('<h2>Чакры</h2>'));
    const bothHtml = buildPrintDocument({...opts,freeDays:'both'});
    assert.equal((bothHtml.match(/class="page /g)||[]).length,32);
    const appendix = buildPrintDocument({...opts,appendices:[{title:'<script>',front:['<img onerror="bad">']}]});
    assert.equal((appendix.match(/class="page /g)||[]).length,32);
    assert.ok(appendix.includes('&lt;script&gt;')); assert.ok(!appendix.includes('<img'));
  }
  const epoch = gregorianDay(-554,12,22);
  const modernYear = fromDay(gregorianDay(2026,9,22)-epoch);
  const modern = buildPrintDocument({year:modernYear,epoch,timezone:'America/Sao_Paulo',latitude:-23.55,selected:['season','bind','lunar'],language:'en',freeDays:'end'});
  for (const name of ['March equinox','June solstice','September equinox','Earth perihelion','Earth aphelion','Full Moon','New Moon','America/Sao_Paulo']) assert.ok(modern.includes(name),name);
  for (const description of ['longest night of the year','longest day of the year','maximum distance between Earth and the Sun','continues to decrease']) assert.ok(modern.includes(description),description);
  const northern = buildPrintDocument({year:modernYear,epoch,timezone:'Europe/London',latitude:51.5,selected:['season'],language:'en',freeDays:'both'});
  assert.ok(northern.includes('The longest day of the year. The North Pole'));
  assert.ok(northern.includes('The longest night of the year. The South Pole'));
  assert.ok(!modern.includes('Unavailable'));
  const oneDay = buildPrintDocument({year:{gc:1,phrase:1,wave:1,year:1},epoch,timezone:'UTC',latitude:0,selected:[],language:'en',freeDays:'start'});
  assert.ok(oneDay.includes('A correction day outside the calendar grid.'));
  assert.ok(oneDay.includes('fill="#dff3df"'));
  const fourDays = buildPrintDocument({year:{gc:1,phrase:1,wave:1,year:13},epoch,timezone:'UTC',latitude:0,selected:[],language:'en',freeDays:'start'});
  assert.ok(fourDays.includes('Correction days outside the calendar grid.'));
  assert.ok(fourDays.includes('stroke="#dff3df"'));
  console.log('Print calendar: chronology, three order modes, circular Free Days, locales, descriptions, layers and appendices passed.');
} finally { await rm(dir,{recursive:true,force:true}); }
