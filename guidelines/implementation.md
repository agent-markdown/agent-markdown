### Streaming

- Batch updates per frame. Keep display repairs separate from source; discard stale math/diagram results.
- Preserve inputs, focus, selection, disclosures, and media playback across updates.
- Keep component identity when updating a title. Apply replacement labels, state, and timer end together.
- Order snapshots or keyed events before rendering. Reset before replacing a document; dispose timers and widgets on unmount.
- Test stream partitions, final convergence, and fallback with individual features disabled.

### Security

- Sanitize HTML and generated SVG; validate resource URLs.
- Isolate previews with an empty sandbox and restrictive CSP: no scripts, network, forms, or parent access.
- Register actions in the host. Validate and authorize submissions; reject duplicates and stale results.

### Performance

- Skip unchanged snapshots, cache usable math/diagrams, share a timer scheduler, and avoid work while hidden.
- Load diagram code on demand. Serialize rendering; limit source size, edge count, and SVG complexity.
- The reference reparses changed snapshots. Profile long streams, replacements, reordering, and retained state.

Details: [renderer API](../src/README.md), [known limits](../docs/implementation-status.md), [streaming](streaming.md), [security](security.md), and [optional host data](host-data.md).
