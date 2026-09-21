# Streaming contract

Draft presentation rules. Received source is authoritative; provisional views are disposable.

| Received prefix | Rich view |
| --- | --- |
| `Read **the pro` | Read **the pro** |
| `[Read more](https://exa` | Read more, without navigation |
| `<details open><summary>Re` | Expandable “Re” row |
| `<p>Read <span title="a >` | Read; unfinished tag hidden |
| `<p>Read <span title="a > b">this` | Read this |
| `<p>A &am` | A; unfinished entity hidden |
| `$x^2` | Typeset the valid expression |
| `$\\frac{1}{` | Keep the last useful typesetting, or nothing |
| Open `mermaid` fence | Nothing by default; optional validated complete-line checkpoints |
| Open `iframe`, `audio`, or `video` | Hold the payload until its closing tag |

- Decode byte streams incrementally before parsing. Never split surrogate pairs in host chunk generation.
- Reveal ordinary prose as each character arrives. A frame-sized batch is fine; a paragraph boundary is not required.
- Buffer only an unfinished token at the tail: tag/quoted attribute, entity, fence header, or ambiguous delimiter opener. Previously usable parent content remains visible.
- A complete safe HTML opening tag establishes its context. Stream its text and valid child tags; do not wait for the outer close. Let the display DOM balance open containers, without changing source.
- With `data-afm-summary="latest"`, derive the header from the latest usable child label in the current snapshot. Appending a child can update the displayed group header without revising earlier source. Keep the authored summary as fallback; preserve expansion and focus.
- Hide an empty disclosure until its summary has usable content; do not flash the browser’s default “Details” label.
- Keep literal contexts literal: fenced/indented code, code spans, math source, preview payload, attributes, and link destinations cannot create AFM formatting.
- Temporarily complete usable inline emphasis/code for display. Incomplete links show their label without a destination; incomplete images do not load a guessed URL.
- Buffer raw script/style payloads for removal, and iframe documents for isolated rendering. Media waits for complete sources/tracks. Opening markup alone grants no execution or network capability.
- HTML forms may appear progressively; the reference disables actions during streaming. A host that enables a completed form earlier needs an explicit committed-component boundary from its transport.
- Attempt safe math prefixes; if invalid, retain only a compatible last valid prefix or nothing. Do not show raw partial TeX or transient errors.
- Mermaid checkpoints occur at complete lines, then parse/render successfully before replacement. This does not promise smooth streaming for every diagram grammar.
- Ordinary code emits characters after its fence header. Hold a partial closing fence; preserve every literal code character in final output. Diff bodies follow the same rule.
- Preserve expansion, focus, selection, entered values, submitted results, and playback. IDs are optional; use stable IDs or host identity for insertion/reordering.
- Coalesce expensive work and ignore stale asynchronous results after updates/reset/disposal. Reveal effects must respect reduced motion and must not restart for every character.
- On interruption, retain only the safe prefix. The reference accepts `{interrupted:true}`: unfinished live timers stop displaying, actions stay disabled, and no completed state is inferred. Resume with another streaming snapshot or finalize explicitly.
- Finalize from the complete original source. Invalid final input may become literal text or a concise diagnostic; provisional repairs must not enter exports.
- Test every character boundary for small fixtures, varied chunk partitions for larger examples, and final equivalence to one-shot rendering. Include code containing tag/delimiter-like text, quoted `>`, escaped delimiters, Unicode, interruption, and malformed input.

The reference reparses snapshots and uses temporary DOM balancing and reconciles the sanitized result in place. It is a readable prototype, not a linear-time incremental parser. Production hosts should retain parser state and DOM identity for larger documents. Arbitrary edits can require reinterpreting an earlier prefix, especially reference links and the short disclosure alias.

## Revising earlier content

Implementation recommendations; no new update syntax is defined.

- Distinguish append deltas from replacements. An appended title grows in place; revising a title before an existing body needs a new snapshot or a keyed host update.
- Keep identity independent of label text. Native `id` remains optional; targeted updates need unique IDs or equivalent host identity established before first display.
- Stream an initial label; apply a replacement label as one validated inline value. Update state and timer end in the same revision. Keep existing content while a replacement is incomplete.
- Preserve child nodes, expansion, focus/selection, and the scroll anchor. A title change should not restart a preview, clear a form, or repeat entry animation.
- Gate revisions in the host, reject stale updates, and recover gaps with a snapshot. Persist the current readable AFM rather than requiring patch replay.

See [implementation limits](../docs/implementation-status.md#limits) and [future directions](../FUTURE.md).
