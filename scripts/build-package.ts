import { cp, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prepareOutput, run } from './artifacts';

const out = await prepareOutput('package');
const workspace = await Bun.file('package.json').json();
const manifest = {
  name: '@agent-markdown/renderer',
  version: '0.1.0-alpha.1',
  description: 'Reference browser renderer for the AFM experimental discussion draft.',
  type: 'module',
  license: 'MIT',
  homepage: 'https://github.com/agent-markdown/agent-markdown',
  repository: {
    type: 'git',
    url: 'git+https://github.com/agent-markdown/agent-markdown.git',
  },
  bugs: 'https://github.com/agent-markdown/agent-markdown/issues',
  exports: {
    '.': { types: './types/index.d.ts', import: './index.js' },
    './mermaid': { types: './types/diagrams.d.ts', import: './diagrams.js' },
    './styles.css': './styles.css',
    './package.json': './package.json',
  },
  types: './types/index.d.ts',
  files: ['*.js', 'types', 'styles.css', 'README.md', 'LICENSE'],
  sideEffects: ['*.css'],
  dependencies: Object.fromEntries(
    ['dompurify', 'katex', 'markdown-it', 'markdown-it-footnote'].map((name) => [
      name,
      workspace.dependencies[name],
    ]),
  ),
  peerDependencies: { mermaid: workspace.dependencies.mermaid },
  peerDependenciesMeta: { mermaid: { optional: true } },
  publishConfig: { access: 'public', tag: 'alpha' },
};
const result = await Bun.build({
  entrypoints: ['src/index.ts', 'src/diagrams.ts'],
  outdir: out,
  target: 'browser',
  format: 'esm',
  packages: 'external',
  minify: false,
});
if (!result.success) throw new AggregateError(result.logs, 'Package build failed');
await run(['bun', 'x', '--no-install', 'tsc', '-p', 'tsconfig.package.json']);
// NodeNext consumers need explicit extensions even in declaration imports.
for (const name of await readdir(join(out, 'types'))) {
  if (!name.endsWith('.d.ts')) continue;
  const file = join(out, 'types', name);
  const source = await Bun.file(file).text();
  await Bun.write(
    file,
    source.replace(
      /(from\s+['"])(\.\/[^'"]+)(['"])/g,
      (_, open, path, close) => open + path + (path.endsWith('.js') ? '' : '.js') + close,
    ),
  );
}
await cp('src/styles.css', join(out, 'styles.css'));
await cp('src/README.md', join(out, 'README.md'));
await cp('LICENSE', join(out, 'LICENSE'));
await Bun.write(join(out, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
await run(
  [
    'bun',
    'pm',
    'pack',
    '--ignore-scripts',
    '--filename',
    resolve('dist/agent-markdown-renderer.tgz'),
  ],
  out,
);
console.log('Built dist/agent-markdown-renderer.tgz. Nothing published.');
