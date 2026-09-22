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

## Website

[afm.inline.chat](https://afm.inline.chat/) hosts the spec and examples. Source stays in [agent-markdown/agent-markdown](https://github.com/agent-markdown/agent-markdown).

- GitHub Actions validates every change. Successful `main` builds deploy to GitHub Pages; pull requests never deploy.
- Deployment uses GitHub's short-lived workflow identity. No external hosting token is stored in the repository.
- The Pages custom domain is `afm.inline.chat`. Its DNS-only CNAME points to `agent-markdown.github.io` through Cloudflare DNS. GitHub manages HTTPS.
- Only the checked `dist/afm-site.tar.gz` contents enter the deployment. The source checkout is never the upload directory.
- The same workflow can be run manually. To roll back, revert the relevant source change and let validation/deployment finish again.

### Hosting options

| Host | Fit |
| --- | --- |
| [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | Selected: public static spec, deployment tied to repository checks |
| [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) | Alternative for custom response headers or future server behavior |
| [Vercel](https://vercel.com/docs/deployments) | Alternative when its preview/deployment workflow is already in use |

The artifact is portable. Serve `dist/site/` at a root domain or a subpath with a trailing slash. Keep `spec/`, `media/`, `katex/`, `chunks/`, notices and license beside the HTML. Missing files must return 404, not the spec page.

```sh
bun run build:site
bun run check:site
bun scripts/serve.ts --root dist/site --base /lab/afm --port 4318
```

GitHub Pages ignores `_headers`, so the build embeds supported CSP directives and a referrer policy in the HTML before assets load. `frame-ancestors` requires an HTTP header and is not enforced by that meta policy. Preview documents retain their own sandbox and CSP. Hosts supporting `_headers` should use the supplied file for the additional response policies.

## npm

Prepared name/version: `@agent-markdown/renderer@0.1.0-alpha.1`. Confirm scope ownership and the final release name before publishing. Keep experimental releases on `alpha`.

- `bun run build:package` creates the exact artifact.
- `bun run check:package` installs it into a separate consumer, checks NodeNext types, bundles it for a browser and renders a fixture.
- Inspect package contents and dependency/license notices before release.
- Publish the reviewed artifact only as a separate authorized release step. Prefer registry trusted publishing for later automated releases.

References: [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [package inspection](https://docs.npmjs.com/cli/pack/), [TypeScript declarations](https://www.typescriptlang.org/tsconfig/emitDeclarationOnly.html).
