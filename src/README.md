# AFM reference renderer

TypeScript browser implementation of the **AFM 0.1 experimental discussion draft**. MIT licensed. The API and draft may change before a stable release.

## Use

The prepared package is `@agent-markdown/renderer`; it has not been published by this repository setup. Install the local tarball with your package manager:

```sh
bun add ./agent-markdown-renderer.tgz
```

```ts
import { AFMRenderer } from '@agent-markdown/renderer';
import '@agent-markdown/renderer/styles.css';
import 'katex/dist/katex.min.css';

const renderer = new AFMRenderer(container, {
  actions: { 'app:answer': (values) => `Received: ${values.choice}` },
});
renderer.render(receivedSource, { streaming: true }); // Full source snapshot so far.
renderer.render(completeSource); // Explicit finalization.
// Or renderer.render(receivedSource, { interrupted: true });
renderer.dispose();
```

- Browser DOM required for rendering. ESM imports are safe without a DOM; server rendering is not implemented.
- Use a bundler. JavaScript dependencies remain external; Mermaid is an optional peer dependency.
- `render()` receives the entire current source, not a delta. The host owns revision ordering.
- `reset()` clears one document's state before reuse. `dispose()` releases listeners, timers and widgets, disables action controls, and rejects further renders.
- Keep one renderer per container. Configure options at construction.

## Options

| Option                                 | Default / meaning                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `mode`                                 | `rich`; `plain` produces an AFM-aware reading projection                              |
| `live`                                 | `true`; `false` suppresses unfinished timers and shimmer for replay                   |
| `formatTime(seconds, format, {state})` | Localize the complete phrase, including spacing                                       |
| `actions`                              | Explicit host handlers; validation and authorization remain the host's responsibility |
| `widgets`                              | Trusted renderer functions, optionally returning a cleanup callback                   |
| `diagram`                              | Optional async source-to-SVG adapter; returned SVG is sanitized                       |
| `diagramStreaming`                     | `closed`; opt into validated complete-line `checkpoints`                              |
| `maxSourceLength`                      | 250,000 UTF-16 code units per snapshot                                                |
| `maxNestingDepth`                      | 128 sanitized DOM levels; Markdown/alias parsers also have limits                     |

```ts
import { renderDiagram } from '@agent-markdown/renderer/mermaid';

const renderer = new AFMRenderer(container, {
  diagram: renderDiagram,
  diagramStreaming: 'checkpoints',
});
```

Install `mermaid` separately for that adapter. It loads lazily and rejects source-controlled configuration, custom styles, links, and image/icon shapes.

## Ownership and limits

- Source cannot register actions, load scripts, or authorize a host operation. Forms remain disabled during streaming.
- Use stable native IDs for reordered or replaced components. Without IDs, position is the fallback; it cannot identify arbitrary moves.
- Unchanged code, ordinary paragraphs, math, diagrams, media and static previews can retain DOM identity across updates. Source-changing or structurally moved content may be rebuilt. Widgets are cleaned up and mounted again on a changed snapshot.
- Snapshot parsing is synchronous. Batch updates per animation frame; large transcripts need host chunking or a more incremental parser. Resource limits are rejection limits, not latency guarantees.
- Media and ordinary links can reference external resources. The host owns network/navigation policy. HTML previews use an empty sandbox and a restrictive CSP.
- `dispose()` invalidates future delivery from pending actions; it cannot undo a side effect already performed by a handler.
- Known grammar edges, accessibility coverage and independent security/conformance review remain work for the experimental draft.

Source, specification and examples: [Agent Markdown](https://github.com/agent-markdown/agent-markdown).
