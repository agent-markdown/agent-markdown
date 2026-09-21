# Reference implementation status

Informative notes for the AFM 0.1 experimental draft. [SPEC.md](../SPEC.md) and [component contracts](semantics.md) define the rules.

## Coverage

- Browser TypeScript renderer: disclosures, activity/timers, cards/forms, citations, diffs, math, static previews and native media.
- Optional Mermaid adapter with validated streaming checkpoints.
- Fixtures cover literal contexts, delimiter boundaries, task/disclosure separation, streamed prefixes and final convergence.
- Interaction tests cover user expansion, focus/selection, validation, pending results, reset and stale asynchronous completions.
- Package checks install the tarball into a separate consumer and verify types, imports, bundling and rendering.
- Site checks cover root and subpath deployment, assets, links and downloadable spec files.

These checks are not full CommonMark/GFM corpus coverage or independent security/accessibility review.

## Limits

- Source snapshots: 250,000 UTF-16 code units; sanitized DOM: 128 levels; aliases: 64 levels; Markdown parser: 100 nesting levels.
- Changed snapshots are reparsed synchronously. DOM reconciliation is incremental; parsing is not. Measure long transcripts in the consuming host.
- Stable IDs preserve sibling identity. Reparenting, unkeyed moves and changed custom widgets can reset local state.
- Actions stay disabled while the document streams. Per-component commitment, delivery, authorization, expiry and replay protection belong to the host.
- `live:false` suppresses live timers/shimmer; it does not revoke registered actions. Omit action handlers for inactive history.
- The fallback view is Markdown-it with HTML stripping, not GitHub's production renderer.
- Server rendering and source-preserving HTML round trips are not implemented.

## Grammar edges open for review

- Long or mixed highlight/spoiler runs and recovery order.
- Dollar math around currency, escaped closers and unfinished final blocks.
- Duplicate/undefined footnotes, label normalization and continuation indentation.
- Malformed mixed HTML/Markdown, duplicate attributes and tree recovery.
- A portable timer lexical profile, including fractional precision and numeric exponents.

Use minimal source, expected semantics and independent fixtures to resolve these. Do not adopt parser recovery as a new rule merely because this implementation emits it. Support statements should name the draft revision, supported capabilities, limits and deviations.
