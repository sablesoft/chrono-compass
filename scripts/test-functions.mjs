import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,copyFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const dir=await mkdtemp(join(tmpdir(),'chrono-do-runtime-'));
const require=createRequire(import.meta.url);
let assertions=0;
try {
  const handlers={};
  for(const name of ['moment','range','year','cycles','openapi']) {
    const path=join(dir,name);await mkdir(path);
    await copyFile('serverless/lib/bundle.cjs',join(path,'bundle.cjs'));
    await copyFile(`serverless/packages/v1/${name}/package.json`,join(path,'package.json'));
    handlers[name]=require(join(path,'bundle.cjs'));
  }
  const invoke=(name,query='',extra={},context={})=>handlers[name].main({http:{method:'GET',path:'',queryString:query,headers:{'x-forwarded-for':'203.0.113.10'},...extra}},{functionName:`/namespace/v1/${name}`,deadline:Date.now()+25000,...context});
  const ok=(condition,message)=>{assert.ok(condition,message);assertions++;};
  let r=await invoke('moment');ok(r.statusCode===200,'default moment');ok(r.body.timezone==='UTC','default UTC');ok(Math.abs(r.body.timestamp-Date.now()/1000)<5,'one captured current moment');
  const query='timestamp=1795521600&timezone=America/Sao_Paulo&include=moon,solar,harmonic_long_cycles';
  r=await invoke('moment',query);ok(r.statusCode===200,'combined cycles');ok(r.body.local.time==='09:00:00','IANA local time');ok(r.body.cycles.moon.status==='available','moon solver');ok(r.body.cycles.solar.status==='available','solar solver');ok(r.body.cycles.harmonic_long_cycles.status==='available','long cycles');
  assert.deepEqual(r.body,handlers.moment.compute('https://test/api/v1/moment?'+query,0).body);assertions++;
  r=await invoke('range','start=0&end=3&step=1.001');assert.deepEqual(r.body.samples.map(s=>s.timestamp),[0,1.001,2.002]);assertions++;
  r=await invoke('year','gc=1&age=1&wave=0&year=1');ok(r.body.calendarDays===368,'free circle year');ok(r.body.samples[0].harmonic.freeDay.label==='S1','free state');
  r=await invoke('cycles');ok(r.body.cycles.length===32,'registry');
  r=await invoke('openapi');ok(r.body.openapi==='3.1.0','OpenAPI');
  for(const query of ['timestamp=1&timestamp=2','timestamp=1795521600000','include=unknown','foo=1','include=moon,moon']) {r=await invoke('moment',query);ok(r.statusCode===400,'invalid '+query);}
  r=await invoke('moment','',{method:'POST'});ok(r.statusCode===405,'method');
  r=await invoke('moment','',{path:'/unexpected'});ok(r.statusCode===404,'path');
  r=await invoke('moment','',{headers:{origin:'https://bad.example'}});ok(r.statusCode===403,'CORS rejection');
  r=await invoke('moment','',{method:'OPTIONS',headers:{origin:'https://chrono-compass.app'}});ok(r.statusCode===204,'preflight');ok(r.headers['Access-Control-Allow-Origin']==='https://chrono-compass.app','allowlisted origin');
  r=await invoke('moment','x'.repeat(8193));ok(r.statusCode===414,'URL bound');
  r=await invoke('moment','timestamp=1795521600&include=pluto_nodal',{}, {deadline:Date.now()+1});ok(r.statusCode===503,'bounded worker deadline');
  r=await invoke('moment','timestamp=1795521600');ok(r.statusCode===200,'next invocation recovers');
  process.env.API_RATE_LIMIT='1';
  const ip={headers:{'x-forwarded-for':'203.0.113.11'}};
  ok((await invoke('moment','timestamp=1795521600',ip)).statusCode===200,'rate first');
  r=await invoke('moment','timestamp=1795521600',ip);ok(r.statusCode===429,'rate bound');ok(r.headers['Retry-After']==='60','retry header');
  delete process.env.API_RATE_LIMIT;
  const yaml=await readFile('serverless/project.yml','utf8');ok((yaml.match(/web: raw/g)||[]).length===5,'raw HTTP preserves duplicate keys');
  ok(!JSON.stringify(r).includes('apiKey'),'no credentials in errors');
  console.log(`DO Functions: ${assertions} checks passed in isolated packages without node_modules.`);
} finally {delete process.env.API_RATE_LIMIT;await rm(dir,{recursive:true,force:true});}
