# Publication and deployment

MIT covers the authored code, spec, examples and website. The generated site includes third-party notices. The root package is marked `private` to prevent accidental npm publication; only `dist/package/` is the npm package. Repository source is public.

## Build and review

```sh
bun install --frozen-lockfile
bun run check
```

Outputs:

- `dist/agent-markdown-renderer.tgz` — installable ESM package with declarations, CSS, README and license.
- `dist/site/` — static spec, examples, local assets and downloadable source documents.
- `dist/afm-site.tar.gz` — the same site as a deployment archive.

Builds preserve previous generated directories under ignored `.build/`. Source files are never deployment output. No build or check command publishes anything.

## Site

Source repository: [agent-markdown/agent-markdown](https://github.com/agent-markdown/agent-markdown). Keep the spec files and site together so examples and rules stay synchronized. Deploy the static output independently.

**Recommended URL:** `https://afm.inline.chat/`. It needs no path routing or separate source repository. `https://inline.chat/lab/afm/` or `https://lab.inline.chat/afm/` also work: mount the same output at that prefix and redirect the prefix without its trailing slash.

Local deployment check:

```sh
bun run build:site
bun scripts/serve.ts --root dist/site --base /lab/afm --port 4318
```

For a static host such as Cloudflare Pages:

- Build: `bun install --frozen-lockfile && bun run build:site`.
- Output: `dist/site`; Bun version: `1.4.0`.
- Add the selected custom domain in the host, then configure its DNS.
- Serve `_headers` rules or their equivalent. Do not rewrite missing assets to `index.html`; this site uses hash navigation and includes a 404 page.
- Keep `spec/`, `media/`, `katex/`, `chunks/`, notices and license beside the HTML.
- CI builds a review artifact. It does not deploy automatically or require production secrets.

See [static HTML deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [headers](https://developers.cloudflare.com/pages/configuration/headers/).

## npm

Prepared name/version: `@agent-markdown/renderer@0.1.0-alpha.1`. Confirm scope ownership and the final release name before publishing. Keep experimental releases on `alpha`.

- `bun run build:package` creates the exact artifact.
- `bun run check:package` installs it into a separate consumer, checks NodeNext types, bundles it for a browser and renders a fixture.
- Inspect package contents and dependency/license notices before release.
- Publish the reviewed artifact only as a separate authorized release step. Prefer registry trusted publishing for later automated releases.

References: [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [package inspection](https://docs.npmjs.com/cli/pack/), [TypeScript declarations](https://www.typescriptlang.org/tsconfig/emitDeclarationOnly.html).
