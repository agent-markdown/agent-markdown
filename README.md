# AFM: Agent Flavored Markdown

The dialect of Markdown for interactive, rich, extensible, and streamable outputs.

**0.1 experimental draft.** Markdown first, with disclosures, activity, timers, cards, simple forms and streaming rules. HTML and attributes add optional enrichment. Features can be implemented independently.

- [Specification](SPEC.md) and [component contracts](docs/semantics.md)
- [Examples](EXAMPLES.md) and [TypeScript renderer](src/README.md)
- [Implementation guide](guidelines/implementation.md) and [known limitations](docs/implementation-status.md)
- [Inspirations](docs/inspirations.md), [future directions](FUTURE.md), and [contributing](CONTRIBUTING.md)

## Preview and validate

```sh
bun install --frozen-lockfile
bun run check
bun run serve
```

Open [the local spec](http://127.0.0.1:4317). Examples show source, rendered output, streaming and Markdown fallback side by side. Serve over HTTP; opening the HTML file directly does not load ES modules.

`bun run build:site` creates the deployable `dist/site/`. `bun run build:package` creates a local renderer tarball. See [distribution instructions](docs/publication.md). These commands do not publish anything.

## Discussion

Propose changes through [issues](https://github.com/agent-markdown/agent-markdown/issues) or [Discussions](https://github.com/agent-markdown/agent-markdown/discussions). Include an example, prior art, fallback and streaming behavior. The draft and reference API may change before a stable release.

MIT covers the authored specification, implementation, examples and website. Dependencies retain their licenses.
