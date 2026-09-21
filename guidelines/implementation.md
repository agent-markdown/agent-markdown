### Parsing

- Keep source separate from display repairs. Use the spec's precedence and literal-context rules.
- Reference limits: 250,000 UTF-16 code units, 64 nested aliases, 100 Markdown nesting levels.
- Run grammar fixtures and stream-partition tests. The Markdown-it comparison is not GitHub's renderer.

### Streaming

- Coalesce updates per frame. Cache useful math/diagram output and discard stale asynchronous results.
- Preserve DOM identity where practical: inputs, focus, disclosure state, and media playback.
- Reset before replacing a document; dispose timers/widgets on unmount.
- The reference reparses snapshots. Profile real transcripts before production use.

### Security

- Sanitize transcript HTML and generated SVG. Validate resource URLs; source attributes grant no permissions.
- Previews use an empty sandbox and restrictive CSP. No scripts, network, forms, or parent access.
- Register actions/widgets in the host. Validate and authorize submissions; protect against duplicates and stale results.
- The Mermaid adapter rejects source configuration, styles, image/icon shapes, and click directives. Production adoption needs a separate security review.

### Live title and activity updates

- Use the same identity when changing a title. IDs remain optional; targeted updates need native `id` or host identity.
- Stream initial labels; apply replacement labels, state, and timer end together. Preserve descendants and user state.
- Prefer snapshots or the host's existing keyed events. Order revisions before rendering; materialize AFM for export.
- The reference retains unchanged static content, summary focus and body selection. Use stable IDs for sibling moves; structural reparenting and custom widgets can still reset state. An optional update profile remains open; see [future directions](../FUTURE.md).

### Performance

- Skip unchanged snapshots; share one timer scheduler. Avoid work while the document is hidden.
- Load diagram code on demand, serialize rendering, and bound source/edge/SVG complexity.
- Measure long streams, replacement/reordering, and retained state.

### Extensions

- Test unsupported features independently. Preserve useful labels, links, and child content.
- Publish supported features, exclusions, revisions, and limits. Keep credentials and private reasoning outside source.

### Presentation

- `data-afm-summary="latest"` derives a group header from its latest usable child row. Keep the same label open or closed, preserve expansion/focus, and retain the authored summary for fallback.
- Activity kinds can select icons; running headers may shimmer. Preserve text labels and respect reduced motion. Do not animate saved or interrupted work as live.
- Hosts may turn ordinary media links into players, using resource metadata or supported URLs. An `.mp3` or `.mp4` suffix is a hint, not AFM syntax or a trusted media type.
- Footer text can use a subdued color; keep it readable in plain output.

See the [streaming guide](streaming.md) and optional [host-data recommendations](host-data.md).
