import { readFileSync, writeFileSync } from 'node:fs';
const inputRows = JSON.parse(readFileSync(new URL('./epoch-results.json', import.meta.url))).rows;
const probeOnly = process.argv.includes('--probe');
const rows = probeOnly ? inputRows.filter(r => [-554, -553].includes(r.year))
  : inputRows.filter(r => r.year >= -1499 && r.year <= 1001);
let times = rows.map(r => r.tt);
async function query(jds, iteration) {
  const input = `!$$SOF\nCOMMAND='10'\nOBJ_DATA='NO'\nMAKE_EPHEM='YES'\nEPHEM_TYPE='OBSERVER'\nCENTER='500@399'\nQUANTITIES='31'\nTIME_TYPE='TT'\nTLIST_TYPE='JD'\nCAL_TYPE='GREGORIAN'\nCSV_FORMAT='YES'\nEXTRA_PREC='YES'\nTLIST=\n${jds.map(t => `'${t.toFixed(9)}'`).join('\n')}\n!$$EOF\n`;
  const form = new FormData();
  form.set('format', 'text');
  form.set('input', new Blob([input]), 'query.txt');
  const response = await fetch('https://ssd.jpl.nasa.gov/api/horizons_file.api', {
    method: 'POST', body: form, signal: AbortSignal.timeout(60000)
  });
  const text = await response.text();
  writeFileSync(new URL(`./jpl-${probeOnly ? 'probe' : 'range'}-${iteration}.txt`, import.meta.url), text);
  if (!response.ok || !text.includes('$$SOE')) throw new Error(text.slice(0, 3000));
  const data = text.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(l => l.split(',').map(v=>v.trim()));
  if (probeOnly) console.log(text);
  return data;
}
if (probeOnly) { await query(times, 0); }
else {
  for (let iteration = 0; iteration < 5; iteration++) {
    const data = await query(times, iteration);
    if (data.length !== times.length) throw new Error('Incomplete response');
    const deltas = data.map(r => (Number(r[3]) - 270) / 1.018);
    if (deltas.some(d => !Number.isFinite(d) || Math.abs(d)>2)) throw new Error('Unexpected longitude data');
    console.log({ iteration, maxResidualSeconds: Math.max(...deltas.map(Math.abs))*86400 });
    if (Math.max(...deltas.map(Math.abs))*86400 < 0.03) break;
    times = times.map((t,i) => t-deltas[i]);
  }
  const intervals = rows.slice(0,-1).map((r,i)=>({year:r.year,startJdTt:times[i],endJdTt:times[i+1],days:times[i+1]-times[i]})).sort((a,b)=>b.days-a.days);
  writeFileSync(new URL('./jpl-intervals.json',import.meta.url),JSON.stringify(intervals,null,2));
  console.log(intervals.slice(0,10));
}
