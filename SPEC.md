# Agent (Flavored) Markdown

The dialect of Markdown for interactive, rich, extensible, and streamable outputs.

AFM is a very early draft to gather feedback. We want to make syntax more consistent between agent outputs and renderers: standardize patterns already in use, keep new syntax readable in existing Markdown renderers, and allow vendor-specific blocks and attributes.

**0.1 experimental draft.** Markdown first. Optional HTML and `data-afm-*` attributes add richer behavior. IDs are optional.

## Example

````markdown
<details open data-afm-type="activity" data-afm-state="running">
<summary>Improving streaming<time datetime="2026-09-18T10:00:00Z" data-afm-format="elapsed"></time></summary>

- <details data-afm-kind="read" data-afm-state="completed">
  <summary>Read the renderer and tests</summary>

  [renderer.ts:42](file:///workspace/project/src/renderer.ts:42) · [renderer.test.ts](./tests/renderer.test.ts)

  ```sh
  rg -n 'displayPrefix|streaming' src/renderer.ts
  ```

  </details>
- <details open data-afm-kind="edit" data-afm-state="completed">
  <summary>Edited 2 files · +3 −2</summary>

  - [+] Buffer incomplete tags

      ```diff
      --- a/src/renderer.ts
      +++ b/src/renderer.ts
      @@ -12,3 +12,4 @@
       export function visible(source: string) {
      -  return source;
      +  const safe = completePrefix(source);
      +  return safe;
       }
      ```

      - [-] Activity labels

          ```diff
          --- a/src/activity.ts
          +++ b/src/activity.ts
          @@ -8,3 +8,3 @@
           export function label(state: State) {
          -  return "Working";
          +  return state === "completed" ? "Worked" : "Working";
           }
          ```

          - [-] Inspect the changes

              ```sh
              git diff --check
              git diff --stat
              ```

  </details>
- <details open data-afm-kind="agent" data-afm-state="running">
  <summary>Review agent<time datetime="2026-09-18T10:00:00Z" data-afm-format="elapsed"></time></summary>

  [Open review](https://example.org/agents/review)

  - <details open data-afm-kind="execute" data-afm-state="running">
    <summary>Checking stream boundaries</summary>

    ```sh
    bun test tests/renderer.test.ts
    ```

    - [-] Latest output

        ```text
        PASS nested disclosures
        PASS literal code and diff boundaries
        Checking remaining stream partitions…
        ```

    </details>

  </details>

</details>

<footer>2 files changed · Review in progress</footer>
````

## Syntax

Markdown first. HTML appears here only for AFM components and enrichment.

| Feature | Syntax |
| --- | --- |
| [Disclosure](EXAMPLES.md#markdown-disclosures) | `- [-] Summary` / `- [+] Summary` with child blocks; or `<details>` + `<summary>`. Add `open` to start expanded. |
| [Short disclosure](EXAMPLES.md#markdown-disclosures) | `> Summary` followed by an indented body. |
| [Activity](EXAMPLES.md#expandable-activity-rows) | `<details data-afm-type="activity">` or `<span data-afm-type="activity">`. |
| [Latest activity](EXAMPLES.md#latest-activity-summary) | `<details data-afm-summary="latest">`; show the latest child label in the header. |
| [State / tool kind](EXAMPLES.md#expandable-activity-rows) | `data-afm-state="running"`, `data-afm-kind="execute"`; optional header shimmer and icon. |
| [Timer](EXAMPLES.md#timers) | `<time datetime="…" data-afm-format="elapsed"></time>`; also `active`, `duration`, `countdown`. |
| [Diff](EXAMPLES.md#diffs) | Fenced `diff`. |
| [HTML preview](EXAMPLES.md#html-preview-lab) | `<iframe title="…">HTML document</iframe>`; readable body, isolated preview. |
| [Footer](EXAMPLES.md#citations-and-footer) | `<footer>…</footer>`; attribution or brief metadata. |
| [Card](EXAMPLES.md#cards--vendor-widgets) | `<section data-afm-type="card">`; primary text, supporting text, body. |
| [Form / inputs](EXAMPLES.md#pick-an-answer) | `<form data-afm-action="…">` with native form controls. |
| [Direct choices](EXAMPLES.md#direct-choices) | `<form data-afm-type="choices">` with submit-button rows. |
| [Buttons](EXAMPLES.md#pick-an-answer) | `<button data-afm-variant="primary">`; also `secondary`. |
| [Provider extensions](EXAMPLES.md#cards--vendor-widgets) | `data-<provider>-*` attributes and provider-qualified `data-afm-type` values. |
| [File location](EXAMPLES.md#files-and-line-numbers) | `[file.ts:42](./file.ts:42)`; absolute paths and `file://` also supported. |
| [Math](EXAMPLES.md#math-all-three-ways) | `$…$`, `$$…$$`, fenced `math`. |
| [Diagram](EXAMPLES.md#diagrams) | Fenced `mermaid`. |
| [Footnote / source](EXAMPLES.md#citations-and-footer) | `[^id]` with `[^id]: …`. |
| [Underline](EXAMPLES.md#the-familiar-vocabulary) | `__text__`. |
| [Strike / highlight](EXAMPLES.md#the-familiar-vocabulary) | `~text~`, `~~text~~` / `==text==`. |
| [Spoiler](EXAMPLES.md#the-familiar-vocabulary) | `\|\|text\|\|` or `<spoiler>text</spoiler>`. |

CommonMark/GFM headings, lists, tasks, tables, links, images, code and emphasis retain their syntax, except where specified below. Fenced `html` displays source; it does not create a preview.

Native HTML equivalents follow the HTML profile, including `figure` / `figcaption`, `audio` / `video`, and `sub` / `sup`. They need no separate AFM syntax.

## 1. Reading this spec

- This document and [Component contracts](docs/semantics.md) define AFM. This document takes precedence. Examples and guides are informative.
- Uppercase requirement words follow [BCP 14](https://www.rfc-editor.org/rfc/rfc2119.html) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html).
- A **producer** writes source; a **renderer** parses and displays it; the **host** supplies resources, actions, navigation, and policy.
- A **provisional view** displays incomplete source. **Finalization** marks the source complete, not the work successful.

## 2. Baseline

- Use [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) plus [GFM 0.29-gfm](https://github.github.com/gfm/)'s tables, tasks, strikethrough, and extended autolinks.
- Precedence: AFM, then those extensions, then CommonMark. Upstream changes do not apply automatically.

| Difference | AFM |
| --- | --- |
| `__text__` | Underline instead of strong emphasis |
| `> Summary` followed by a four-column child | Disclosure |
| `summary` body | Inline Markdown |
| Readable `iframe` body | Isolated HTML preview |

- Other native names keep their [HTML meanings](https://html.spec.whatwg.org/multipage/). `spoiler` and `data-afm-*` are AFM additions.
- AFM defines its own HTML policy, separate from GFM's tag filter. `_italic_`, tilde fences, and blocks in lists remain supported.

## 3. Partial support

- Implement features independently. State the draft revision, implementation version, supported features, exclusions, deviations, and limits.
- AFM's intentional differences preclude full GFM compatibility.

| Feature | Fallback |
| --- | --- |
| Formatting, links, disclosures, citations | Ordinary readable content |
| Activity/timers | Summary; no generated timer phrase |
| Cards/forms/buttons | Card content; inactive or omitted controls |
| Math | Completed source as code |
| Diagrams/diffs | Fenced source |
| HTML previews | Omission |
| Media | Image, caption, or link |

- Preserve useful content when an enhancement is unsupported. Keep essential text outside removable UI: unrelated renderers may unwrap, escape, or discard HTML.
- An AFM exporter must not be needed for readable fallback.

## 4. Parsing

- Keep baseline whitespace, escaping, indentation, and code rules. Code, attributes, link destinations, math source, and preview bodies are literal contexts.
- Underline, strikethrough, highlight, and spoilers follow the [inline rules](docs/semantics.md#inline-formatting).
- Disclosures contain ordinary blocks recursively. Tasks remain tasks. Only the defined [short alias](docs/semantics.md#disclosures-and-mixed-content) changes quote parsing.
- Put blank lines around Markdown inside HTML containers, or use HTML children. `summary` accepts inline Markdown.
- Hosts resolve [file links and line locations](docs/semantics.md#file-links-and-line-locations).
- Fence identifiers: `math`, `mermaid`, `diff`, `html`. HTML fences stay code. Preserve source separately from its rendered view.

## 5. Streaming

- Chunk boundaries do not change meaning.
- Show usable text as it arrives. Frame-sized batches are fine; waiting for a paragraph is unnecessary.
- Buffer unfinished tags, attributes, entities, fence headers, and delimiters. Stream content after a complete safe HTML opener.
- Balance markup only for display. Never save invented closures, navigate partial links, or load guessed URLs.
- Typeset usable math; otherwise keep the last compatible result or buffer. Never show raw incomplete TeX. Diagram checkpoints replace the last good view only after validation.
- Hold previews/media until closed. Keep unsafe content inert. Actions wait for finalization or an explicit host commitment for that component.
- Preserve edits, focus/selection, expansion, and pending/submitted results across appends. Reordering needs host identity; authored IDs remain optional.
- Interruption keeps a safe prefix, disables uncommitted actions, and hides unfinished live timers. It does not assign activity state.
- Final output must match one-shot parsing of the original source under the same host policy. Exclude clock values, generated IDs, and user state from byte comparisons.
- Earlier content may change as context arrives. Timing, animation, and parser architecture belong to the host.

## 6. Extensions and actions

- Attribute names and optional IDs follow [Attributes and identity](docs/semantics.md#attributes-and-identity).
- Unknown widgets preserve safe children unless `data-afm-fallback="omit"` requests removal.
- Extensions cannot redefine shared behavior or grant permissions.
- Actions require registered handlers and host validation. Rendering, disclosures, timers, and diffs do not execute actions.
- Preview attributes cannot enable scripts, network, or a host bridge. Transport, permissions, and tool execution are outside AFM.

## 7. Errors and limits

| Input | Result |
| --- | --- |
| Unmatched final Markdown | Baseline recovery; discard provisional repairs |
| Unknown metadata | Ignore enhancement; retain safe content |
| Invalid timer | No generated phrase |
| Invalid completed math/diagram | Concise diagnostic; retain source |
| Unsupported action | Inactive or omitted controls |
| Unsafe HTML/URL | Apply host sanitization/URL policy |
| Resource limit | Documented stop/degradation; report incomplete rendering |

- Publish limits for source size, nesting, and processing work. Recursive grammar does not require unlimited resources.
- Preserve labels, reading order, keyboard access, and control state. Avoid repeated timer announcements; respect reduced motion.
- Styling belongs to the renderer.

## 8. Draft status

See [implementation status](docs/implementation-status.md) for coverage and known gaps. Use the [proposal process](CONTRIBUTING.md) to suggest changes.
