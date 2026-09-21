export interface Example {
  id: string;
  title: string;
  description: string;
  source: string;
}
export const examples: Example[] = [
  {
    id: 'overview',
    title: 'A work trace',
    description: 'Nested tool calls, patches, commands, and live activity.',
    source:
      '<details open data-afm-type="activity" data-afm-state="running">\n<summary>Improving streaming<time datetime="{{START}}" data-afm-format="elapsed"></time></summary>\n\n- <details data-afm-kind="read" data-afm-state="completed">\n  <summary>Read the renderer and tests</summary>\n\n  [renderer.ts:42](file:///workspace/project/src/renderer.ts:42) · [renderer.test.ts](./tests/renderer.test.ts)\n\n  ```sh\n  rg -n \'displayPrefix|streaming\' src/renderer.ts\n  ```\n\n  </details>\n- <details open data-afm-kind="edit" data-afm-state="completed">\n  <summary>Edited 2 files · +3 −2</summary>\n\n  - [+] Buffer incomplete tags\n\n      ```diff\n      --- a/src/renderer.ts\n      +++ b/src/renderer.ts\n      @@ -12,3 +12,4 @@\n       export function visible(source: string) {\n      -  return source;\n      +  const safe = completePrefix(source);\n      +  return safe;\n       }\n      ```\n\n      - [-] Activity labels\n\n          ```diff\n          --- a/src/activity.ts\n          +++ b/src/activity.ts\n          @@ -8,3 +8,3 @@\n           export function label(state: State) {\n          -  return "Working";\n          +  return state === "completed" ? "Worked" : "Working";\n           }\n          ```\n\n          - [-] Inspect the changes\n\n              ```sh\n              git diff --check\n              git diff --stat\n              ```\n\n  </details>\n- <details open data-afm-kind="agent" data-afm-state="running">\n  <summary>Review agent<time datetime="{{START}}" data-afm-format="elapsed"></time></summary>\n\n  [Open review](https://example.org/agents/review)\n\n  - <details open data-afm-kind="execute" data-afm-state="running">\n    <summary>Checking stream boundaries</summary>\n\n    ```sh\n    bun test tests/renderer.test.ts\n    ```\n\n    - [-] Latest output\n\n        ```text\n        PASS nested disclosures\n        PASS literal code and diff boundaries\n        Checking remaining stream partitions…\n        ```\n\n    </details>\n\n  </details>\n\n</details>\n\n<footer>2 files changed · Review in progress</footer>',
  },
  {
    id: 'activity',
    title: 'Expandable activity rows',
    description: 'Each summary is the row. No repeated bullet label.',
    source:
      '<details open data-afm-type="activity" data-afm-state="running">\n<summary>Working<time datetime="{{START}}" data-afm-format="elapsed"></time></summary>\n\n- <details data-afm-type="activity" data-afm-kind="read" data-afm-state="completed">\n  <summary>Read the project documentation</summary>\n\n  The project uses Markdown and HTML.\n\n  </details>\n- <details open data-afm-type="activity" data-afm-kind="execute" data-afm-state="completed">\n  <summary>Ran the tests</summary>\n\n  ```text\n  24 passed. No failures.\n  ```\n\n  </details>\n- <details data-afm-type="activity" data-afm-kind="agent" data-afm-state="running">\n  <summary>Research assistant is checking sources</summary>\n\n  [Open subagent](https://example.org/agents/research)\n\n  - [x] Read the grammar\n  - [ ] Compare streaming behavior\n\n  </details>\n\n</details>',
  },
  {
    id: 'disclosures',
    title: 'Markdown disclosures',
    description: '[-] collapsed; [+] expanded. Tasks remain tasks.',
    source:
      '- [-] Read files\n    - README.md\n    - [+] Run checks\n\n        ```text\n        24 passed.\n        ```\n\n        - [x] Tests\n        - [ ] Review\n\n> Short alias\n    Indented content makes a disclosure.',
  },
  {
    id: 'timer',
    title: 'Timers',
    description: 'Wall elapsed, active, fixed duration, countdown.',
    source:
      '<span data-afm-type="activity" data-afm-state="running">Thinking<time datetime="{{START}}" data-afm-format="elapsed"></time></span>\n\n<span data-afm-type="activity" data-afm-state="running">Working<time datetime="{{START}}" data-afm-format="active" data-afm-elapsed="90"></time></span>\n\n<span data-afm-type="activity" data-afm-state="paused">Paused<time data-afm-format="active" data-afm-elapsed="107"></time></span>\n\nCompleted<time datetime="PT2M17S" data-afm-format="duration"></time>\n\nResponse window<time datetime="{{DEADLINE}}" data-afm-format="countdown"></time>',
  },
  {
    id: 'cards',
    title: 'Cards & vendor widgets',
    description: 'Expand a file to inspect its patch. Sample changes; no repository mutation.',
    source:
      '<section data-afm-type="card">\n\n**[Web preview](https://example.org/report)**\n\nWebsite\n\n</section>\n\n<section data-afm-type="example:changes">\n\n**Edited 3 files**\n\n3 additions · 3 deletions\n\n<details open>\n<summary>README\\.md · +1 −1</summary>\n\n```diff\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-# Agent Markdown\n+# AFM: Agent Flavored Markdown\n```\n\n</details>\n<details>\n<summary>SPEC\\.md · +1 −1</summary>\n\n```diff\n--- a/SPEC.md\n+++ b/SPEC.md\n@@ -1 +1 @@\n-Render incomplete HTML immediately.\n+Stream content after a complete HTML opening tag.\n```\n\n</details>\n<details>\n<summary>renderer.ts · +1 −1</summary>\n\n```diff\n--- a/renderer.ts\n+++ b/renderer.ts\n@@ -1 +1 @@\n-render(source);\n+render(displayPrefix(source));\n```\n\n</details>\n\n<button type="button" data-afm-variant="primary" data-afm-action="demo:review">Review sample</button>\n\n</section>',
  },
  {
    id: 'forms',
    title: 'Pick an answer',
    description: 'Choices, descriptions, and custom response belong to one fieldset.',
    source:
      '<form id="review-question" data-afm-action="demo:answer" data-afm-fallback="omit">\n  <fieldset>\n    <legend>What should we explore next?</legend>\n    <label><input type="radio" name="topic" value="Activity" checked> Activity and timers</label>\n    <label><input type="radio" name="topic" value="Cards"> Cards and artifacts\n      <span>File reviews, previews, and attachments.</span>\n    </label>\n    <div>\n      <label><input type="radio" name="topic" value="Custom"> Custom response</label>\n      <textarea name="note" aria-label="Custom response" placeholder="Your answer…" rows="1"></textarea>\n    </div>\n  </fieldset>\n  <button type="submit" data-afm-variant="primary">Send answer</button>\n  <button type="reset" data-afm-variant="secondary">Reset</button>\n</form>',
  },
  {
    id: 'choices',
    title: 'Direct choices',
    description: 'A row is an action; its second line is supporting text.',
    source:
      '<form data-afm-type="choices" data-afm-action="demo:choice">\n<fieldset>\n<legend>Connect an integration</legend>\n<button type="submit" name="integration" value="notion">\n<span>Notion</span><span>Store commitments in a database</span>\n</button>\n<button type="submit" name="integration" value="slack">\n<span>Slack</span><span>Find promises in messages</span>\n</button>\n</fieldset>\n</form>',
  },
  {
    id: 'citations',
    title: 'Citations and footer',
    description: 'Named footnotes and ordinary footer content.',
    source:
      'Disclosures can contain arbitrary flow content.[^html]\nA source can support several statements.[^html]\n\n<footer>\n\nPrepared from the linked specification. Last checked September 15, 2026.\n\n</footer>\n\n[^html]: [HTML: the details element](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element). See the content model.',
  },
  {
    id: 'formatting',
    title: 'The familiar vocabulary',
    description: 'Markdown first, with underline, highlight and spoilers. Code stays literal.',
    source:
      '**Bold** · *italic* · __underline__ · ~strike~ · ~~strike~~ · ==highlight==\n\nThe answer is ||a hidden detail||. H<sub>2</sub>O and x<sup>2</sup>.\n\n> A useful standard keeps ordinary writing ordinary.\n\n- [x] Markdown first\n- [x] Optional vendor data\n- [ ] Independent conformance testing\n\n```ts\nconst literal = "__not underline inside code__";\n```',
  },
  {
    id: 'diff',
    title: 'Diffs',
    description: 'Unified changes with line numbers and source context.',
    source:
      '```diff\n--- a/renderer.ts\n+++ b/renderer.ts\n@@ -48,6 +48,7 @@\n export function render(source: string) {\n-  const visible = waitForBlock(source);\n+  const visible = projectStreamingSyntax(source);\n   const tree = parse(visible);\n+  preserveExpansion(tree);\n   updateView(tree);\n   return tree;\n }\n```',
  },
  {
    id: 'math',
    title: 'Math, all three ways',
    description:
      'Inline and display dollar notation, plus a math fence. Typeset locally with KaTeX.',
    source:
      'Inline: $E = mc^2$.\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$\n\n```math\n\\begin{pmatrix}1 & 0 \\\\ 0 & 1\\end{pmatrix}\n```\n\nA literal price: \\$20.',
  },
  {
    id: 'diagrams',
    title: 'Diagrams',
    description: 'Compact diagrams; only usable streaming revisions appear.',
    source: '```mermaid\nflowchart LR\n  Source --> Parser\n  Parser --> Renderer\n```',
  },
  {
    id: 'preview',
    title: 'HTML preview lab',
    description: 'An isolated interface. Try its tabs and disclosure; no scripts or network.',
    source:
      '<iframe title="Review lab" sandbox>\n<!doctype html>\n<html lang="en">\n<head><style>\nbody { font: 13px/1.6 system-ui; color: #333; margin: 16px; }\nnav { display: flex; gap: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }\nlabel { cursor: pointer; } input { accent-color: #666; }\narticle { padding-top: 12px; } p { margin: 8px 0; }\n.patch { display: none; }\nbody:has(#patch:checked) .summary { display: none; }\nbody:has(#patch:checked) .patch { display: block; }\ncode { font: 12px/1.6 ui-monospace, monospace; }\nsummary { cursor: pointer; }\n</style></head>\n<body>\n<strong>Review lab</strong>\n<nav aria-label="Preview view">\n<label><input type="radio" name="view" checked> Summary</label>\n<label><input type="radio" name="view" id="patch"> Changes</label>\n</nav>\n<article class="summary">\n<p>Streaming now reveals readable text as it arrives.</p>\n<details><summary>Checks</summary><p>Tasks, disclosures, and literal code remain distinct.</p></details>\n</article>\n<article class="patch"><code>− waitForBlock(source)<br>+ projectStreamingSyntax(source)</code></article>\n</body>\n</html>\n</iframe>',
  },
  {
    id: 'source',
    title: 'HTML as source',
    description: 'HTML in a code fence stays code. It never becomes a preview.',
    source:
      '```html\n<section>\n  <h1>This stays source code.</h1>\n  <button>Not an active control</button>\n</section>\n```',
  },
];

examples.push({
  id: 'media',
  title: 'Images, charts, audio & video',
  description: 'Ordinary media links; optional HTML players. Hosts may also enhance the links.',
  source: `[Listen to the summary](media/tone.wav)

[Watch the walkthrough](media/review.mp4)

<figure>
<img src="media/checks.svg" alt="Checks passed: 8 before, 12 after" width="360" height="160">
<figcaption>Checks passed before and after the change.</figcaption>
</figure>

| Revision | Passed |
| --- | ---: |
| Before | 8 |
| After | 12 |

<audio id="sample-audio" preload="none" src="media/tone.wav"></audio>

[Audio sample](media/tone.wav) · A quiet half-second test tone.

<video id="sample-video" preload="none" width="360" height="160" src="media/review.mp4"></video>

[Video sample](media/review.mp4) · Two-second synthetic rendering fixture.

[Download chart](media/checks.svg)`,
});

examples.push({
  id: 'file-links',
  title: 'Files and line numbers',
  description: 'Ordinary links. A file-aware host opens the referenced line.',
  source: `[SPEC.md:10](/workspace/project/SPEC.md:10)

[renderer.ts:42](./src/renderer.ts:42)

[Local source:42](file:///workspace/project/src/renderer.ts:42)

[Design notes:12](</workspace/project/Design notes.md:12>)`,
});

examples.push({
  id: 'latest-activity',
  title: 'Latest activity summary',
  description: 'The latest child labels the group, open or closed. Stream to watch it update.',
  source: `<details open data-afm-type="activity" data-afm-summary="latest" data-afm-state="running">
<summary>Checking the renderer</summary>

- <details data-afm-kind="read" data-afm-state="completed">
  <summary>Read renderer.ts</summary>

  [renderer.ts:42](./src/renderer.ts:42)

  </details>
- <details data-afm-kind="execute" data-afm-state="completed">
  <summary>Ran the renderer tests</summary>

  \`\`\`sh
  bun test tests/renderer.test.ts
  \`\`\`

  24 passed.

  </details>
- <span data-afm-type="activity" data-afm-kind="think" data-afm-state="completed">Checked scrolling during streaming</span>
- <span data-afm-type="activity" data-afm-kind="think" data-afm-state="running">Checking text selection<time datetime="{{START}}" data-afm-format="elapsed"></time></span>

</details>`,
});
