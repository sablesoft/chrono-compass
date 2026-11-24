import { writeFile } from 'node:fs/promises';
import { build } from 'vite';
for (const name of ['compute', 'index']) {
  await build({configFile: false, publicDir: false, build: {
    ssr: `server/${name}.ts`, outDir: 'dist-ssr', emptyOutDir: name === 'compute',
    rollupOptions: {output: {entryFileNames: `${name}.js`}}
  }});
}

await build({configFile: false, publicDir: false, build: {
  ssr: 'scripts/moment-api-schema.ts', outDir: 'dist-ssr', emptyOutDir: false,
  rollupOptions: {output: {entryFileNames: 'schema.js'}}
}});
const {openapi} = await import('../dist-ssr/schema.js');
await writeFile('docs/moment-api.openapi.json', JSON.stringify(openapi, null, 2) + '\n');
