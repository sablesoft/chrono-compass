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
  for (const year of [{gc:1,phrase:1,wave:0,year:1},{gc:1,phrase:1,wave:1,year:1},{gc:0,phrase:122,wave:0,year:4}]) {
    const start = printPeriods(year,'start'), end = printPeriods(year,'end');
    assert.equal(start[0].moon,14); assert.equal(end[13].moon,14);
    assert.deepEqual(start[0],end[13]);
    assert.equal(start[0].days.at(-1).absolute + 1, start[1].days[0].absolute);
    const days = start.flatMap(p=>p.days.map(d=>d.absolute));
    assert.equal(new Set(days).size, days.length);
    assert.ok([365,368].includes(days.length));
    const opts = {year,epoch:-921517,timezone:'UTC',selected:[],language:'en',freeDays:'end'};
    const html = buildPrintDocument(opts);
    assert.equal((html.match(/class="page /g)||[]).length,30);
    assert.ok(html.includes('</section><section class="page back blank"></section>'));
    assert.equal((html.match(/class="page front"/g)||[]).length,15);
    assert.equal((html.match(/class="page back/g)||[]).length,15);
    assert.ok(!html.includes('<h2>Chakras</h2>'));
    const ru = buildPrintDocument({...opts,language:'ru',selected:['gregorian','chakras','dreamspell','season','bind','lunar']});
    for (const label of ['Григорианские даты','Чакры','Dreamspell','Сезонные события','Расстояние Земля–Солнце','Фазы Луны','Недоступно']) assert.ok(ru.includes(label),label);
    const appendix = buildPrintDocument({...opts,appendices:[{title:'<script>',front:['<img onerror="bad">']}]});
    assert.equal((appendix.match(/class="page /g)||[]).length,32);
    assert.ok(appendix.includes('&lt;script&gt;')); assert.ok(!appendix.includes('<img'));
  }
  const epoch = gregorianDay(-554,12,22);
  const modern = buildPrintDocument({year:fromDay(gregorianDay(2026,9,22)-epoch),epoch,timezone:'America/Sao_Paulo',selected:['season','bind','lunar'],language:'en',freeDays:'end'});
  for (const name of ['March equinox','June solstice','September equinox','Earth perihelion','Earth aphelion','Full Moon','New Moon','America/Sao_Paulo']) assert.ok(modern.includes(name),name);
  assert.ok(!modern.includes('Unavailable'));
  console.log('Print calendar: ordering, ownership, pairing, locales, layers and appendices passed.');
} finally { await rm(dir,{recursive:true,force:true}); }
