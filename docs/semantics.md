# Component contracts

Part of [SPEC.md](../SPEC.md). These rules apply to supported features. Examples and reference notes are informative.

## Attributes and identity

- Use native HTML attributes for native meanings. `type` describes an input/button; `data-afm-type` describes an AFM component.
- `action` is a URL; `data-afm-action` names a host handler.

| Attribute | Element | Values |
| --- | --- | --- |
| `data-afm-type` | `details`/`span`, `section`, `form` | `activity`, `card`, `choices`, or provider-qualified type |
| `data-afm-kind` | Activity/disclosure | Kind below, or provider-qualified kind |
| `data-afm-summary` | `details` | `latest`: project the latest child label |
| `data-afm-state` | Activity/disclosure/time | State below |
| `data-afm-format` | `time` | `elapsed`, `active`, `duration`, `countdown` |
| `data-afm-end` | Elapsed timer | End timestamp |
| `data-afm-elapsed` | Active timer | Accumulated seconds |
| `data-afm-variant` | `button` | `primary`, `secondary` |
| `data-afm-action` | `form`, standalone `button` | Registered handler name |
| `data-afm-fallback` | Provider widget | `omit` when unsupported |
| `data-<provider>-*` | Extension | Provider data |

- Shared values are case-sensitive. Unknown values add no meaning. Missing attributes retain normal element behavior, subject to host policy and the timer rules below.
- Provider types use names such as `inline:changes`. They cannot redefine shared attributes. No bare `afm-*` alias is defined.
- IDs are optional, document-local, and preferably unique/stable. Preserve user state across unrelated appends.
- Replacing a question needs a new identity or host reset. IDs never grant authority.

**Reference note:** the renderer scopes DOM IDs and references, keeps the first duplicate target, and uses positional/action keys without IDs. Arbitrary reordering needs stronger host identity.

## File links and line locations

```markdown
[SPEC.md:10](/workspace/project/SPEC.md:10)
[renderer.ts:42](./src/renderer.ts:42)
[Local source:42](file:///workspace/project/src/renderer.ts:42)
[Design notes:12](</workspace/project/Design notes.md:12>)
```

- Ordinary links; no wrapper required. `:line` is positive and one-based. Labels are free text.
- Absolute paths, `./`/`../` paths, and `file://` URLs are supported. Bare `filename:10` may look like a URL scheme. Wrap spaces in `<…>` or percent-encode them.
- Preserve destinations and remote fragments such as `#L42`, subject to URL policy. Hosts resolve local files/lines; generic web renderers may retain the link.
- Do not reinterpret ports or remote URLs as local locations. The host opens the referenced file and line.

## Inline formatting

- `**bold**` and italics follow the baseline. Replace recognized underscore strong emphasis with underline: `__text__`. Intraword `foo__bar__baz` stays literal.
- `~text~` and `~~text~~` follow GFM. Three or more tildes stay literal inline; tilde fences still work.
- `==` and `||` use CommonMark left-/right-flanking rules. Match the same delimiter within a paragraph. Other inline formatting may occur inside.
- Escapes and literal contexts take precedence. A code span containing `||` cannot close a spoiler.
- Tables split cells first. Use `<spoiler>text</spoiler>` within a cell.
- Spoilers conceal presentation, not access to source.

Long/mixed highlight and spoiler runs still need [independent fixtures](implementation-status.md#grammar-edges-open-for-review).

## Disclosures and mixed content

```markdown
- [-] Read files
    - README.md
- [+] Run checks
    All checks passed.

> Short alias
    Indented body.
```

- `[-]` starts collapsed; `[+]` starts expanded. Other baseline list markers are accepted. Task markers remain separate.
- Match the start of a list item's first paragraph: marker, at least one space/tab, then a nonempty summary. Its first line is inline Markdown; continuation lines/blocks form the body. The body may be empty. Otherwise parse an ordinary list item. Escape `[` for a literal marker.
- The alias requires `>`, one space, a non-whitespace summary start, then an immediate nonblank line at least four columns deeper in the same container. It starts collapsed. Indented code never becomes an alias; other shapes remain quotes.
- Tabs use baseline column expansion. A nonblank dedent ends the alias body; blank lines are allowed inside.
- `details` uses its first `summary`. `open` sets the initial state; later user expansion wins. Summary bodies accept inline Markdown. Other HTML uses baseline block boundaries.
- Bodies accept recursive blocks with normal list indentation. Literal contexts stay literal. Depth need not add visual indentation; publish runtime limits.

## Activity

- Use `data-afm-type="activity"` on `details` or `span` for public summaries.
- Kinds: `read`, `edit`, `search`, `execute`, `think`, `fetch`, `agent`, `system`, `other`, or a provider-qualified value. Unknown kinds render neutrally.

| State | Meaning |
| --- | --- |
| `pending` | Scheduled, not started |
| `running` | Working |
| `waiting` | Awaiting input/dependency |
| `paused` | Deliberately suspended |
| `completed` | Reported success |
| `failed` | Reported failure |
| `cancelled` | Stopped without completion |

- Terminal states are `completed`, `failed`, and `cancelled`.
- State is optional. Missing/unknown state and stream completion never imply success. Resume/retry needs an explicit state update.
- Disclosures may also carry `data-afm-state` and `data-afm-kind` directly. A parent's state does not assign state to its child activities.
- `running` may shimmer the summary or inline activity label. Waiting, paused, terminal, and unknown states stay static. Disable live effects in replay/interruption; respect reduced motion.
- Kinds may select decorative tool icons. Keep the text label; icons and animation are optional renderer presentation.

### Latest child summary

- `details data-afm-summary="latest"` shows the last child disclosure/activity label in its summary, open or closed. Keep an authored `summary` for empty groups and unsupported renderers.
- Eligible rows are child `details` and `span data-afm-type="activity"`, directly or inside list/paragraph wrappers. Use document order, not timestamps. Ignore empty labels, output bodies, footers, and controls.
- Treat nested disclosures as one row. An inner `latest` group can project its own latest child; never search its output for a label.
- Project inline formatting, spoilers, timers, and the child's decorative kind. Links become label text; do not duplicate IDs, navigation, or controls. Timers retain their child's state; the group's state remains independent.
- Show the same label in both expansion states. Keep the original child row in the body. Projection does not change source, export, or user expansion.
- During streaming, switch when a new child has usable label content, then grow both labels together. Buffer incomplete syntax as usual. Empty scaffolding does not replace the previous label; snapshot removal/reordering selects from the current children.
- Preserve summary focus and avoid per-character live announcements. Unknown `data-afm-summary` values retain the authored summary.

## Time

| Format | Inputs | Result |
| --- | --- | --- |
| `elapsed` | `datetime` start; optional `data-afm-end` | Now or end minus start |
| `active` | `data-afm-elapsed`; `datetime` resume | Accumulated seconds plus running interval |
| `duration` | `datetime` ISO duration | Fixed duration |
| `countdown` | `datetime` deadline | Remaining time, minimum zero |

- A timer may be empty. Generate the whole localized phrase and separator; tick locally. Removal must leave no dangling “for”.
- Instants need timezones. Seconds must be finite/nonnegative. Durations use days/hours/minutes/seconds, not calendar months/years. Invalid values generate nothing.
- Active time is fixed while pending/waiting/paused/terminal. Resume updates accumulated seconds and resume instant. Missing state allows a valid live interval; unknown state generates nothing.
- Wall elapsed continues through waiting/paused. Pending has no live elapsed timer. Terminal elapsed requires a valid end; never infer one from arrival time.
- Countdown continues through pauses, disappears for terminal states, and never triggers an action. Duration stays fixed.
- Replay/interruption hides unfinished live counters; fixed values remain usable. State comes from the timer or nearest activity. Hosts handle clocks/localization.

**Reference note:** `live:false` selects replay. Strict timestamp/duration validation remains in [implementation status](implementation-status.md#grammar-edges-open-for-review).

## Cards and forms

- `section data-afm-type="card"`: first direct paragraph is primary text, second supporting text, remaining children the body. Keep that order readable without styling.
- Unknown provider widgets retain sanitized children, unless `data-afm-fallback="omit"` requests removal. Other sanitizers may ignore the hint.
- Use native text inputs, textarea, radio/checkbox choices, single select, and submit/reset buttons. Group questions with `fieldset`/`legend` and labels; keep descriptions/custom responses in the group.
- `form data-afm-type="choices"` uses submit-button rows. First/second child spans are primary/supporting text; plain button text also works. Submit the activated button's `name`/`value`.
- Radio selection alone does not submit. Text and multiple selections require explicit submit.
- Button variants: `primary`, `secondary`; unknown/missing uses the host default.
- `data-afm-action` selects a registered handler. Without one, disable controls. No native form navigation.
- Validate before submitting. Send successful named controls and the submitter's value; repeated names produce an ordered string array.
- Preserve authored disabling. Disable actions during streaming/interruption and while pending. Retain successful results; prevent repeat submission. Failure allows retry with values intact.
- Preserve edits, focus/selection, expansion, and responses across appends. Form reset restores defaults; document reset discards old async results. Neither undoes a completed external action.
- Hosts own validation, authorization, duplicate protection, and persistence. Uploads, multi-step flows, transport retries, and executing-action cancellation remain outside this draft.

## Content and optional renderers

| Content | Rule |
| --- | --- |
| Math | Dollar contents have non-whitespace inner boundaries. A close followed by a digit is not a close. Escape ambiguous currency. Display forms: `$$` lines or `math` fence. |
| Diff | Preserve patch markers/lines. Rendering never applies changes. |
| Mermaid | Keep code fallback. Replace a checkpoint only after validation; never save guessed closures. |
| HTML | `html` fences stay literal. Readable iframe bodies are isolated preview payloads. |
| Citations | `[^label]` references `[^label]: content`. Repeated references share a note with return navigation. Preserve links and footer attribution. |
| Footer | `footer` contains supporting attribution or brief metadata. Keep its text and links in reading order and in plain fallback; subdued styling is optional. |
| Images/charts | Image, alt text, caption, accessible data; optional `figure`/`figcaption`. |
| Audio/video | Ordinary links or HTML `audio`/`video`/`source`/`track`. Controls belong to the renderer. |

- The first fence info-string word identifies the format. No AFM options are defined for remaining words.
- The first case-insensitive closing iframe tag ends its payload; avoid literal occurrences inside. Preview source cannot enable scripts, network, navigation, or a host bridge.
- Footnote labels are separate from HTML IDs. Use unique, nonempty labels without whitespace. Duplicate/case recovery remains an open edge; structured provenance is future work.
- Keep download/transcript links outside removable players. Media waits for closure; preserve playback across unrelated appends.
- Albums are ordered images/figures. Optional [tool/resource data](../guidelines/host-data.md) stays outside the grammar.
