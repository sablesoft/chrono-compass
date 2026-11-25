import {build} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out=await mkdtemp(join(tmpdir(),'chrono-client-'));
try {
  await build({logLevel:'error',build:{outDir:out,emptyOutDir:true},plugins:[{
    name:'client-server-boundary',generateBundle(_options,bundle) {
      const ids=[...new Set(Object.values(bundle).flatMap(item=>item.type==='chunk'?Object.keys(item.modules):[]))];
      const server=ids.filter(id=>/\/src\/lib\/api\/|\/server\/|\/serverless\/|moment-api-schema|@js-temporal\/polyfill/.test(id));
      if(server.length) throw Error('Server-only modules found in browser bundle: '+server.join(', '));
      console.log(`Offline client: ${ids.length} modules; zero API/server/Functions modules.`);
    }
  }]});
} finally {await rm(out,{recursive:true,force:true});}
