import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from './artifacts';

const tarball = resolve('dist/agent-markdown-renderer.tgz');
const consumer = await mkdtemp(join(tmpdir(), 'afm-consumer-'));
const workspace = await Bun.file('package.json').json();
await writeFile(
  join(consumer, 'package.json'),
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      '@agent-markdown/renderer': `file:${tarball}`,
      jsdom: workspace.devDependencies.jsdom,
    },
  }),
);
await run(['bun', 'install', '--ignore-scripts'], consumer);
const installed = join(consumer, 'node_modules/@agent-markdown/renderer');
const files = await readdir(installed);
if (
  files.some(
    (file) =>
      ![
        'index.js',
        'diagrams.js',
        'types',
        'styles.css',
        'README.md',
        'LICENSE',
        'package.json',
      ].includes(file),
  )
)
  throw new Error('Unexpected file in package');
await writeFile(
  join(consumer, 'ssr.ts'),
  "const api = await import('@agent-markdown/renderer'); if(typeof api.AFMRenderer !== 'function') throw new Error('Missing API'); console.log('DOM-free ESM import passed');\n",
);
await run(['bun', 'ssr.ts'], consumer);
await writeFile(
  join(consumer, 'consumer.ts'),
  `import { AFMRenderer, type RendererOptions } from '@agent-markdown/renderer';
const options: RendererOptions = { maxNestingDepth: 128, actions: { answer: values => String(values.choice) } };
const renderer = new AFMRenderer(document.createElement('div'), options);
renderer.render('**Typed consumer**'); renderer.dispose();
`,
);
await run(
  [
    'bun',
    resolve('node_modules/typescript/bin/tsc'),
    '--noEmit',
    '--strict',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    'consumer.ts',
  ],
  consumer,
);
await writeFile(
  join(consumer, 'smoke.ts'),
  `import { JSDOM } from 'jsdom';
const window = new JSDOM('<!doctype html><body><main></main>',{url:'https://example.org/'}).window;
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLFormElement','FormData']) Object.defineProperty(globalThis,key,{value:key==='window'?window:key==='document'?window.document:window[key],configurable:true});
const {AFMRenderer} = await import('@agent-markdown/renderer');
const root=document.querySelector('main'); const renderer=new AFMRenderer(root);
renderer.render('- [+] **Packaged**\\n    Body',{streaming:true});
renderer.render('- [+] **Packaged**\\n    Body');
if(root.querySelector('summary strong')?.textContent!=='Packaged')throw new Error('Packed renderer failed');
renderer.dispose(); console.log('Installed tarball renders successfully');
`,
);
await run(['bun', 'smoke.ts'], consumer);
const bundled = await Bun.build({
  entrypoints: [join(consumer, 'consumer.ts')],
  outdir: join(consumer, 'bundle'),
  target: 'browser',
});
if (!bundled.success) throw new AggregateError(bundled.logs, 'Consumer browser bundle failed');
console.log(
  'Package exports, declarations, isolated install, browser bundle and rendering passed.',
);
