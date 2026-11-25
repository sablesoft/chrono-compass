import { build } from 'vite';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'chrono-functions-'));
try {
  let inputs=[];
  await build({configFile:false,publicDir:false,logLevel:'error',ssr:{noExternal:true},plugins:[{
    name:'function-source-digest',generateBundle(_options,bundle) {
      inputs=[...new Set(Object.values(bundle).flatMap(item=>item.type==='chunk'?Object.keys(item.modules):[]))]
        .filter(path=>!path.includes('node_modules') && !path.startsWith('\0')).map(path=>relative(process.cwd(),path.split('?')[0]));
    }
  }],build:{ssr:'serverless/src/handler.ts',target:'node22',minify:'esbuild',outDir:temporary,emptyOutDir:true,rollupOptions:{output:{format:'cjs',entryFileNames:'bundle.cjs',inlineDynamicImports:true}}}});
  inputs=[...new Set([...inputs,'scripts/build-functions.mjs','package-lock.json'])].sort();
  const hash=createHash('sha256');
  for(const path of inputs) {hash.update(path+'\0');hash.update(await readFile(path));}
  const bundle=await readFile(join(temporary,'bundle.cjs'));
  const manifest=JSON.stringify({sourceSha256:hash.digest('hex'),bundleSha256:createHash('sha256').update(bundle).digest('hex'),inputs},null,2)+'\n';
  if(process.argv.includes('--check')) {
    if(!(await readFile('serverless/lib/bundle.cjs')).equals(bundle) || await readFile('serverless/lib/manifest.json','utf8')!==manifest) throw Error('Functions artifact is stale. Run npm run build:functions and commit the generated bundle and manifest.');
  } else {
    await writeFile('serverless/lib/bundle.cjs',bundle);
    await writeFile('serverless/lib/manifest.json',manifest);
  }
  console.log(`Functions bundle: ${bundle.length} bytes; ${inputs.length} verified inputs${process.argv.includes('--check')?' (current)':''}.`);
} finally {await rm(temporary,{recursive:true,force:true});}
