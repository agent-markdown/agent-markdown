import { JSDOM } from 'jsdom';
import { serveSite } from './serve';
import { publishedDocs } from './site-config';
import { examples } from '../src/examples';
import { specPage } from './spec-page';
import { resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

// Downloadable documents must be self-contained, including links nested in tables.
const markdown = new MarkdownIt();
const publicPaths = new Set(publishedDocs);
function checkLinks(tokens: Token[], origin: string) {
  for (const token of tokens) {
    const href = token.attrGet('href');
    if (href && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
      const target = new URL(href, 'https://afm.invalid/' + origin);
      if (!publicPaths.has(decodeURIComponent(target.pathname.slice(1))))
        throw new Error(`Unpublished document link in ${origin}: ${href}`);
    }
    if (token.children) checkLinks(token.children, origin);
  }
}
for (const path of publishedDocs.filter((path) => path.endsWith('.md')))
  checkLinks(markdown.parse(await Bun.file(path).text(), {}), path);

// An explicit release surface prevents local workspace content entering the site.
const publicAssets = new Set([
  '.afm-build',
  'index.html',
  'app.js',
  'style.css',
  'afm.css',
  '404.html',
  '_headers',
  'LICENSE',
  'THIRD-PARTY-NOTICES.md',
  'media/README.md',
  'media/checks.svg',
  'media/tone.wav',
  'media/review.mp4',
  ...publishedDocs.map((path) => 'spec/' + path),
]);
for await (const path of new Bun.Glob('**/*').scan({ cwd: 'dist/site', dot: true })) {
  if (!publicAssets.has(path) && !/^(?:chunks\/.*\.js|assets\/[^/]+|katex\/.*)$/.test(path))
    throw new Error(`Unexpected deployment file: ${path}`);
}

const source = await Bun.file('SPEC.md').text();
const components = await Bun.file('docs/semantics.md').text();
const sections = specPage(source, components);
const ids = new Set([
  ...sections.map((section) => section.id),
  ...examples.map((example) => example.id),
  'implementation',
  'future',
  'spec',
]);
for (const link of source.matchAll(/\]\(EXAMPLES\.md#([^)]*)\)/g)) {
  if (
    !examples.some(
      (example) =>
        example.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s/g, '-') === link[1],
    )
  )
    throw new Error(`Broken example link: ${link[0]}`);
}
if (ids.size < examples.length) throw new Error('Incomplete site sections');
for (const base of ['', '/lab/afm']) {
  const server = serveSite({ root: 'dist/site', base, port: 0 });
  try {
    const origin = server.url.origin;
    const url = origin + base + '/';
    const response = await fetch(url);
    if (response.status !== 200 || !response.headers.get('Content-Security-Policy'))
      throw new Error('Missing HTML or security headers');
    const dom = new JSDOM(await response.text(), { url });
    const assets = Array.from(dom.window.document.querySelectorAll('[src],link[href]')).map(
      (node) => node.getAttribute('src') ?? node.getAttribute('href')!,
    );
    for (const asset of [
      ...assets,
      'media/checks.svg',
      'media/tone.wav',
      'media/review.mp4',
      ...publishedDocs.map((path) => 'spec/' + path),
      'THIRD-PARTY-NOTICES.md',
    ]) {
      const found = await fetch(new URL(asset, url));
      if (found.status !== 200) throw new Error(`Missing asset at ${base || '/'}: ${asset}`);
    }
    for (const path of [
      'missing.html',
      '.afm-build',
      '%2e%2e%2fpackage.json',
      'lab.html',
      'lab.js',
      'spec/AGENTS.md',
      'spec/docs/decisions.md',
    ]) {
      const missing = await fetch(url + path);
      if (missing.status !== 404) throw new Error('Invalid path served: ' + path);
    }
    if (base) {
      const redirect = await fetch(origin + base, { redirect: 'manual' });
      if (redirect.status !== 308 || redirect.headers.get('Location') !== base + '/')
        throw new Error('Missing slash redirect');
    }
  } finally {
    server.stop(true);
  }
}
for (const path of publishedDocs) {
  const built = await Bun.file(resolve('dist/site/spec', path)).text();
  if (built !== (await Bun.file(path).text())) throw new Error('Stale published source: ' + path);
}
console.log(
  'Root and /lab/afm/ deployment paths, assets, source documents and syntax links passed.',
);
