# Optional host data

Recommendations, not a required AFM transport, tool API, or new syntax. Adopt fields only when the host needs them.

## Media and files

- Selected Markdown form: `[Listen](summary.mp3)` / `[Watch](demo.mp4)`. A host may enhance the link into a player; ordinary navigation remains valid. Optional HTML `audio` / `video` supplies explicit players. No media-specific marker or wrapper is required.

- Keep document references readable: `[report.pdf](https://example.org/report.pdf)`, `![Chart](chart.svg)`, native HTML media.
- Use a separately supplied attachment record for stable ID, URI, MIME type, display name, byte size, dimensions/duration, thumbnail, caption/transcript, and availability (`pending`, `ready`, `failed`, `expired`). Only include known metadata; do not infer trust from a MIME label.
- Prefer portable HTTPS links. App-specific resource URLs may resolve through a host registry; do not silently make arbitrary schemes executable or copy temporary credentials into saved Markdown.
- Albums are ordered attachments with per-item captions and an optional group caption. Ordinary images/figures are the baseline; grid, gallery, and carousel are renderer choices. Preserve document order in fallback.
- Charts need units, alt text, and accessible values. A static image and table provide a useful baseline. A vendor renderer may add interaction without changing those values.
- Provide download/transcript links outside audio/video elements. Native HTML fallback content alone is insufficient when a sanitizer removes the entire element.
- The reference supports browser media elements and preserves unchanged playback nodes. Upload, download authorization, codec negotiation, network consent, and attachment resolution belong to the host.

Telegram uses structured media send methods and captions; `sendMediaGroup` takes 2–10 items. New Rich Messages accept Markdown, HTML, or structured blocks, with separately supplied media referenced by IDs. This supports the separation above; it does not require copying Telegram's URL schemes into AFM. Sources: [media groups](https://core.telegram.org/bots/api#sendmediagroup), [rich message input](https://core.telegram.org/bots/api#inputrichmessage).

## Tool and activity adapters

Recommended adapter data, inspired by [ACP tool calls](https://agentclientprotocol.com/protocol/tool-calls) and [AG-UI events](https://docs.ag-ui.com/concepts/events):

| Record | Useful fields | Document representation |
| --- | --- | --- |
| Activity | ID, parent ID, public title, kind, explicit state, start/end, accumulated duration | Activity disclosure/span and time |
| Tool result | Call ID, tool name, result status, public text, resource references | Disclosure with normal blocks |
| File change | Resource URI, before/after identity, unified patch, additions/deletions if known | Link and `diff` fence |
| Resource | Attachment ID, URI, MIME type, readable title, availability | Image, media element, or link |
| Action request | Request ID, handler name, input schema, expiry/revision | Registered form/buttons |
| Action outcome | Request ID, submission ID, accepted/rejected/cancelled status, readable result | Updated form state and result text |

- Retain the existing protocol's identifiers, statuses, and versions. Translate explicitly; do not assume every protocol has the same lifecycle.
- Keep public summaries separate from private reasoning, hidden tool arguments, credentials, and permissions.
- Arrival order and transport completion do not imply success. Interrupted, failed, cancelled, waiting-for-input, and completed are distinct outcomes.
- Optional stable IDs bind updates to a component. A result must not overwrite a newer revision or another form's response.
- Data attributes may carry optional qualified references, but must not execute a tool, authorize a request, or select arbitrary host code.
- Preserve raw source patches and resource metadata; rendering is not an instruction to apply a diff or open a file.

## Inputs and user state

- Prefer HTML form semantics: `label`, `fieldset`, `legend`, `input`, `select`, `textarea`, and submit `button`.
- A single-choice row may itself be a submit button. Multiple selection and free text should use an explicit submit; custom text belongs inside the same question group.
- Keep readable labels separate from submitted values. Make descriptions ordinary supporting text; associate with `aria-describedby` where needed.
- Defaults initialize the view once. Later streaming must preserve edits, cursor/selection, focus, user expansion, and pending/submitted results.
- IDs are optional; stable unique IDs help when forms/components are reordered. Keep field names and order stable without them. The reference's field-position fallback does not support arbitrary reordering without a host adapter.
- New question meaning requires a new identity or explicit reset. Do not erase entered text because a label or title changed.
- Author `open` is an initial preference. A user collapsing or expanding a disclosure takes precedence on subsequent updates.
- The reference disables submission during streaming, deduplicates in-flight submissions, and rejects stale completions after reset. Production hosts also need server validation, expiry, replay protection, cancellation, and an idempotency key.
- Do not turn every selection or keystroke into a tool call. Validate locally for feedback and again in the accepting service; permission-sensitive actions remain host-controlled.
