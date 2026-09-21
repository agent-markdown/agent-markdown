import { beforeEach, afterEach, describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
const browser = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
  .window;
for (const name of [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'HTMLFormElement',
  'FormData',
  'Event',
  'KeyboardEvent',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value:
      name === 'window'
        ? browser
        : name === 'document'
          ? browser.document
          : (browser as unknown as Record<string, unknown>)[name],
  });
}
const { AFMRenderer } = await import('../src/renderer');
const { renderHTML } = await import('../src/parser');
const { examples } = await import('../src/examples');
let host: HTMLElement;
let instances: InstanceType<typeof AFMRenderer>[] = [];
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  instances.forEach((r) => r.dispose());
  instances = [];
  host.remove();
});
function renderer(options: ConstructorParameters<typeof AFMRenderer>[1] = {}) {
  const r = new AFMRenderer(host, options);
  instances.push(r);
  return r;
}

describe('AFM reference semantics', () => {
  test('GFM tasks remain distinct from disclosure markers and literal code', () => {
    renderer().render(
      '- [ ] Pending\n    - Child\n- [x] Complete\n- [X] Also complete\n- [-] Collapsed\n    - [ ] Nested task\n- [+] Expanded\n\n`- [x] literal`',
    );
    const boxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
    expect(boxes.map((b) => b.checked)).toEqual([false, true, true, false]);
    expect(host.querySelector('details:not([open]) > summary')?.textContent).toBe('Collapsed');
    expect(host.querySelector('details[open] > summary')?.textContent).toBe('Expanded');
    expect(host.querySelector('code')?.textContent).toBe('- [x] literal');
  });

  test('underline override, both strikes, highlight, spoilers, literal code', () => {
    renderer().render('__underline__ **bold** ~one~ ~~two~~ ==mark== ||secret|| `__literal__`');
    expect(host.querySelector('u')?.textContent).toBe('underline');
    expect(host.querySelector('strong')?.textContent).toBe('bold');
    expect(host.querySelectorAll('s,del')).toHaveLength(2);
    expect(host.querySelector('mark')?.textContent).toBe('mark');
    expect(host.querySelector('spoiler')?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('code')?.textContent).toBe('__literal__');
  });
  test('native nested disclosures inside list items and task checkboxes', () => {
    renderer().render(
      examples
        .find((e) => e.id === 'activity')!
        .source.replace('{{START}}', new Date().toISOString()),
    );
    expect(host.querySelectorAll('li > details')).toHaveLength(3);
    expect(host.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
    expect(host.querySelectorAll('li.disclosure-item')).toHaveLength(3);
    expect(host.querySelectorAll('.afm-activity-icon')).toHaveLength(3);
    expect(host.querySelector('progress')).toBeNull();
  });
  test('empty timer disappears in plain export', () => {
    renderer({ mode: 'plain' }).render(
      'Working<time datetime="2026-09-14T10:00:00Z" data-afm-format="elapsed"></time>',
    );
    expect(host.textContent?.trim()).toBe('Working');
  });
  test('fixed timer and terminal unfinished suppression', () => {
    renderer().render(
      '<time datetime="2026-09-14T10:00:00Z" data-afm-end="2026-09-14T10:02:17Z" data-afm-format="elapsed"></time>',
    );
    expect(host.textContent).toContain('2m 17s');
    renderer().render(
      '<span data-afm-state="completed">Done<time datetime="2026-09-14T10:00:00Z" data-afm-format="elapsed"></time></span>',
    );
    expect(host.textContent?.trim()).toBe('Done');
  });
  test('live timer and replay policy', () => {
    const source =
      '<time datetime="' +
      new Date(Date.now() - 10000).toISOString() +
      '" data-afm-format="elapsed"></time>';
    renderer().render(source);
    expect(host.textContent).toContain('10s');
    renderer({ live: false }).render(source);
    expect(host.textContent?.trim()).toBe('');
  });
  test('plain cards keep coherent prose, controls are omitted', () => {
    renderer({ mode: 'plain' }).render(examples.find((e) => e.id === 'cards')!.source);
    expect(host.querySelector('a')?.textContent).toBe('Web preview');
    expect(host.textContent).toContain('Website');
    expect(host.querySelector('button')).toBeNull();
  });
  test('all math forms typeset, diff remains literal', () => {
    renderer().render(examples.find((e) => e.id === 'math')!.source);
    expect(host.querySelectorAll('.katex')).toHaveLength(3);
    renderer().render('```diff\n+<script>alert(1)</script>\n```');
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('<script>');
  });
  test('preview is sandboxed and postponed during streaming', () => {
    const r = renderer();
    const source = examples.find((e) => e.id === 'preview')!.source;
    r.render(source.slice(0, source.lastIndexOf('</iframe>')), { streaming: true });
    expect(host.querySelector('iframe')).toBeNull();
    r.render(source, { streaming: true });
    expect(host.querySelector('iframe')).not.toBeNull();
    r.render(source);
    const frame = host.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.srcdoc).toContain("default-src 'none'");
    expect(frame.srcdoc).toContain('Review lab');
  });
  test('HTML source fence never previews', () => {
    renderer().render(examples.find((e) => e.id === 'source')!.source);
    expect(host.querySelector('iframe,button')).toBeNull();
    expect(host.querySelector('code')?.textContent).toContain('<button>');
  });
  test('sanitizer strips executable transcript markup and URL schemes', () => {
    const html = renderHTML(
      '<img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
    );
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });
  test('registered form submits once and retains response after rerender', async () => {
    let count = 0;
    const r = renderer({
      actions: {
        'demo:answer': async (values) => {
          count++;
          return 'Saved ' + values.topic;
        },
      },
    });
    const source = examples.find((e) => e.id === 'forms')!.source;
    r.render(source);
    const form = host.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count).toBe(1);
    expect(host.textContent).toContain('Saved Activity');
    r.render(source);
    expect(host.textContent).toContain('Saved Activity');
    expect(host.querySelector('button')?.disabled).toBe(true);
  });
  test('missing handlers and streaming forms cannot submit', () => {
    const source = examples.find((e) => e.id === 'forms')!.source;
    renderer().render(source);
    expect(host.querySelector('button')?.disabled).toBe(true);
    renderer({ actions: { 'demo:answer': async () => '' } }).render(source, { streaming: true });
    expect(host.querySelector('button')?.disabled).toBe(true);
  });
  test('input and disclosure state survive append snapshots', () => {
    const r = renderer({ actions: { 'demo:answer': async () => '' } });
    const source =
      '<details><summary>Notes</summary>\n\nBody\n\n</details>\n\n' +
      examples.find((e) => e.id === 'forms')!.source;
    r.render(source);
    const details = host.querySelector('details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    const input = host.querySelector('textarea')!;
    input.value = 'My draft';
    input.dispatchEvent(new Event('input'));
    r.render(source + '\n\nMore text');
    expect(host.querySelector('details')?.open).toBe(true);
    expect(host.querySelector('textarea')?.value).toBe('My draft');
  });
  test('sample stream partitions converge to full finalized HTML', () => {
    const source = examples[0].source;
    const r = renderer({ live: false });
    for (let i = 1; i < source.length; i += 23) r.render(source.slice(0, i), { streaming: true });
    r.reset();
    r.render(source);
    const final = host.innerHTML;
    const other = document.createElement('div');
    const full = new AFMRenderer(other, { live: false });
    instances.push(full);
    full.render(source);
    expect(final).toBe(other.innerHTML);
  });
  test('baseline underscore italic and tilde code fences remain accepted', () => {
    renderer().render('_italic_\n\n~~~text\nliteral\n~~~');
    expect(host.querySelector('em')?.textContent).toBe('italic');
    expect(host.querySelector('code')?.textContent).toBe('literal\n');
  });
  test('vendor widgets require host registration and honor omission', () => {
    let mounted = 0;
    let disposed = 0;
    const source = '<example-widget data-afm-fallback="omit">Vendor content</example-widget>';
    renderer().render(source);
    expect(host.querySelector('example-widget')).toBeNull();
    const r = renderer({
      widgets: {
        'example-widget': (el) => {
          mounted++;
          el.textContent = 'Native widget';
          return () => {
            disposed++;
          };
        },
      },
    });
    r.render(source, { streaming: true });
    expect(mounted).toBe(0);
    r.render(source);
    expect(mounted).toBe(1);
    expect(host.textContent).toContain('Native widget');
    r.dispose();
    expect(disposed).toBe(1);
  });
  test('streaming disables links and malformed metadata does not crash', () => {
    renderer().render('[Go](https://example.org)\n\n', { streaming: true });
    expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(() => renderer().render('<span data-math="%broken"></span>')).not.toThrow();
  });

  test('async response updates the current snapshot after a stream append', async () => {
    let complete!: (value: string) => void;
    const r = renderer({
      actions: {
        'demo:answer': () =>
          new Promise<string>((resolve) => {
            complete = resolve;
          }),
      },
    });
    const source = examples.find((e) => e.id === 'forms')!.source;
    r.render(source);
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    r.render(source + '\n\nMore context');
    expect(host.textContent).toContain('Submitting');
    complete('Accepted once');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.textContent).toContain('Accepted once');
    expect(host.querySelector('button')?.disabled).toBe(true);
  });
});

describe('streaming math, time, evidence and grouped answers', () => {
  test('every math prefix withholds raw TeX, including multiline displays and invalid fence tails', () => {
    const source =
      'Inline: $E=mc^2$.\n\n$$\n\\frac{1}{3}\n\n+ x^2\n$$\n\n```math\n\\frac{a}{b}\n```';
    const r = renderer();
    for (let i = 1; i < source.length; i++) {
      r.render(source.slice(0, i), { streaming: true });
      const copy = host.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('.katex').forEach((n) => n.remove());
      expect(copy.textContent).not.toMatch(/[\\$]/);
      expect(host.querySelector('.katex-error')).toBeNull();
    }
    r.render(source);
    expect(host.querySelectorAll('.katex')).toHaveLength(3);
  });
  test('final invalid math has a neutral error and literal currency is recovered', () => {
    const r = renderer();
    r.render('```math\n\\frac{\n```', { streaming: true });
    expect(host.textContent?.trim()).toBe('');
    r.render('```math\n\\frac{\n```');
    expect(host.textContent).toContain('Math could not be typeset.');
    r.render('Costs $20', { streaming: true });
    r.render('Costs $20');
    expect(host.textContent?.trim()).toBe('Costs $20');
  });
  test('active timing covers pause, resume, completion and replay without per-second source changes', () => {
    const original = Date.now;
    Date.now = () => Date.parse('2026-09-15T10:00:10Z');
    try {
      const r = renderer();
      r.render(
        '<time data-afm-format="active" data-afm-state="running" data-afm-elapsed="90" datetime="2026-09-15T10:00:00Z"></time>',
      );
      expect(host.textContent).toContain('1m 40s');
      r.render(
        '<time data-afm-format="active" data-afm-state="waiting" data-afm-elapsed="100"></time>',
      );
      expect(host.textContent).toContain('1m 40s');
      Date.now = () => Date.parse('2026-09-15T10:01:10Z');
      r.render(
        '<time data-afm-format="active" data-afm-state="running" data-afm-elapsed="100" datetime="2026-09-15T10:01:00Z"></time>',
      );
      expect(host.textContent).toContain('1m 50s');
      r.render(
        '<time data-afm-format="active" data-afm-state="completed" data-afm-elapsed="110"></time>',
      );
      expect(host.textContent).toContain('1m 50s');
      renderer({ live: false }).render(
        '<time data-afm-format="active" data-afm-state="completed" data-afm-elapsed="110"></time>',
      );
      expect(host.textContent).toContain('1m 50s');
      r.render(
        '<time data-afm-format="active" data-afm-state="waiting" data-afm-elapsed="-1"></time>',
      );
      expect(host.textContent?.trim()).toBe('');
    } finally {
      Date.now = original;
    }
  });
  test('duration, countdown, expiry and host formatting are independent of elapsed wording', () => {
    const original = Date.now;
    Date.now = () => Date.parse('2026-09-15T10:00:00Z');
    try {
      const r = renderer();
      r.render('<time datetime="PT2M17S" data-afm-format="duration"></time>');
      expect(host.textContent).toContain('2m 17s');
      r.render('<time datetime="2026-09-15T10:00:30Z" data-afm-format="countdown"></time>');
      expect(host.textContent).toContain('30s remaining');
      r.render('<time datetime="2026-09-15T09:00:00Z" data-afm-format="countdown"></time>');
      expect(host.textContent).toContain('0s remaining');
      renderer({ formatTime: (s) => ' (' + s + ' seconds)' }).render(
        '<time datetime="PT30S" data-afm-format="duration"></time>',
      );
      expect(host.textContent?.trim()).toBe('(30 seconds)');
      renderer({ mode: 'plain' }).render(examples.find((e) => e.id === 'timer')!.source);
      expect(host.textContent).not.toMatch(/\b(for|in|remaining)\b/);
    } finally {
      Date.now = original;
    }
  });
  test('named citations repeat, link to scoped notes and survive plain export with footer content', () => {
    const source = examples.find((e) => e.id === 'citations')!.source;
    renderer().render(source);
    const refs = host.querySelectorAll<HTMLAnchorElement>('.footnote-ref a');
    expect(refs).toHaveLength(2);
    expect(host.querySelectorAll('.footnote-item')).toHaveLength(1);
    expect(host.querySelector('footer')?.textContent).toContain('Last checked');
    expect(refs[0].hash).toBe(refs[1].hash);
    expect(host.querySelector('.footnote-item')?.id).toBe(refs[0].hash.slice(1));
    const oldId = host.querySelector('.footnote-item')!.id;
    renderer().render(source);
    expect(host.querySelector('.footnote-item')!.id).not.toBe(oldId);
    renderer({ mode: 'plain' }).render(source);
    expect(host.textContent).toContain('See the content model.');
    expect(host.querySelector('a[href^="https:"]')).not.toBeNull();
  });
  test('typing a custom answer selects its choice and submits it within the group', async () => {
    let answer: Record<string, string | string[]> = {};
    const r = renderer({
      actions: {
        'demo:answer': async (v) => {
          answer = v;
          return 'Received';
        },
      },
    });
    const source = examples.find((e) => e.id === 'forms')!.source;
    r.render(source);
    const input = host.querySelector('textarea')!;
    expect(input.closest('fieldset')).not.toBeNull();
    input.value = 'Citations';
    input.dispatchEvent(new Event('input'));
    r.render(source + '\n\nAdditional context.');
    expect(host.querySelector<HTMLInputElement>('input[value="Custom"]')?.checked).toBe(true);
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(answer.topic).toBe('Custom');
    expect(answer.note).toBe('Citations');
  });
});

describe('HTML boundary streaming', () => {
  test('ordinary HTML contents advance character by character after complete opening tags', () => {
    const r = renderer();
    for (let i = 0; i <= 5; i++) {
      r.render('<details open id="work"><summary>**' + 'Ready'.slice(0, i), { streaming: true });
      expect(host.querySelector('summary')?.textContent ?? '').toBe('Ready'.slice(0, i));
      if (i) expect(host.querySelector('summary strong')?.textContent).toBe('Ready'.slice(0, i));
    }
    r.render('<details open id="work"><summary>Ready</summary><div>Result <span title="a >', {
      streaming: true,
    });
    expect(host.textContent).toBe('ReadyResult ');
    expect(host.querySelector('span')).toBeNull();
    r.render(
      '<details open id="work"><summary>Ready</summary><div>Result <span title="a > b">yes',
      { streaming: true },
    );
    expect(host.querySelector('span')?.textContent).toBe('yes');
  });
  test('incomplete tags leave the previous usable snapshot intact', () => {
    const r = renderer();
    r.render('Before\n\n- <details', { streaming: true });
    const first = host.firstChild;
    r.render('Before\n\n- <details title="partial', { streaming: true });
    expect(host.firstChild).toBe(first);
    expect(host.querySelector('li')).toBeNull();
    r.render('Before\n\n- <details><summary>Wait', { streaming: true });
    expect(host.querySelector('summary')?.textContent).toBe('Wait');
  });
  test('literal contexts and complete void tags remain renderable', async () => {
    const { displayPrefix } = await import('../src/streaming');
    for (const source of [
      '```html\n<div>\n```',
      '`<span>`',
      '$a <b> c$',
      '<https://example.org>',
      '<input type="text">',
    ])
      expect(displayPrefix(source)).toBe(source);
    expect(displayPrefix('Before<img alt="a > b"')).toBe('Before');
    expect(displayPrefix('Before<!-- partial')).toBe('Before');
    expect(displayPrefix('<iframe><p>Inside</p>')).toBe('');
  });
  test('file cards include inspectable source patches', () => {
    renderer().render(examples.find((e) => e.id === 'cards')!.source);
    expect(host.querySelectorAll('details .afm-diff')).toHaveLength(3);
    expect(host.textContent).toContain('+render(displayPrefix(source));');
  });
});

test('diff headers are metadata and patch lines retain exact newlines', () => {
  const patch = '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n';
  renderer().render('```diff\n' + patch + '```');
  expect(host.querySelector('.diff-heading')?.textContent).toBe('file+1 −1');
  expect(host.querySelector('.removed .line-number')?.textContent).toBe('1');
  expect(host.querySelector('.added td:nth-child(2)')?.textContent).toBe('1');
  expect(host.querySelectorAll('.diff-line.removed')).toHaveLength(1);
  expect(host.querySelectorAll('.diff-line.added')).toHaveLength(1);
  expect(host.querySelector('pre code')?.textContent).toBe(patch);
});

describe('Markdown disclosures and checkpoint streaming', () => {
  test('nested canonical disclosures embed fences, tasks, paragraphs and math', () => {
    renderer().render(
      '- [-] Parent\n    - [x] Done\n    - [+] Child\n\n        ```js\n        const x = 1;\n        ```\n\n        $x^2$',
    );
    expect(host.querySelectorAll('li > details')).toHaveLength(2);
    expect(host.querySelector('details details')?.hasAttribute('open')).toBe(true);
    expect(host.querySelector('pre code')?.textContent).toBe('const x = 1;\n');
    expect(host.querySelectorAll('.katex')).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
  });
  test('alias requires immediate four-column children; normal quotes and literal fences survive', () => {
    renderer().render(
      '> Parent\n    > Child\n        Result\n\nOutside\n\n> Quote\n> continued\n\n```text\n- [-] literal\n> literal\n```',
    );
    expect(host.querySelectorAll('details')).toHaveLength(2);
    expect(host.querySelector('details details')?.textContent).toContain('Result');
    expect(host.querySelector('blockquote')?.textContent).toContain('continued');
    expect(host.querySelector('pre')?.textContent).toContain('- [-] literal');
    expect(host.querySelector('details')?.textContent).not.toContain('Outside');
  });
  test('user expansion survives the next chunk even before toggle dispatch', () => {
    const r = renderer();
    r.render('- [-] Parent\n    Body');
    host.querySelector('details')!.open = true;
    r.render('- [-] Parent\n    Body\n\nMore');
    expect(host.querySelector('details')!.open).toBe(true);
  });
  test('plain projection keeps summaries, bodies and tasks without disclosure chrome', () => {
    renderer({ mode: 'plain' }).render('- [-] Parent\n    Text\n    - [x] Done');
    expect(host.querySelector('details')).toBeNull();
    expect(host.textContent).toContain('Parent');
    expect(host.textContent).toContain('Text');
  });
  test('text, provisional emphasis and literal code advance without a block boundary', () => {
    const r = renderer();
    r.render('Ready.\n\nA **part', { streaming: true });
    expect(host.textContent?.trim()).toBe('Ready.\nA part');
    expect(host.querySelector('strong')?.textContent).toBe('part');
    r.render('Ready.\n\nA **complete** paragraph.\n\n', { streaming: true });
    expect(host.querySelector('strong')?.textContent).toBe('complete');
    r.render('```js\nconst a = 1;\nconst b =', { streaming: true });
    expect(host.querySelector('code')?.textContent).toBe('const a = 1;\nconst b =');
  });
  test('Mermaid is held until a fence closes unless checkpoints are enabled', () => {
    const r = renderer();
    r.render('```mermaid\nflowchart LR\nA --> B\n', { streaming: true });
    expect(host.textContent).toBe('');
    r.render('```mermaid\nflowchart LR\nA --> B\n```', { streaming: true });
    expect(host.querySelector('code')?.textContent).toContain('A --> B');
  });
  test('stale diagram responses never replace newer content; SVG is sanitized', async () => {
    const replies: ((s: string) => void)[] = [];
    const r = renderer({ diagram: () => new Promise((resolve) => replies.push(resolve)) });
    r.render('```mermaid\nflowchart LR\nA-->B\n```');
    await new Promise((r) => setTimeout(r, 5));
    r.render('```mermaid\nflowchart LR\nA-->C\n```');
    await new Promise((r) => setTimeout(r, 5));
    replies[1]('<svg><text>new</text><script>alert(1)</script></svg>');
    await Promise.resolve();
    replies[0]('<svg><text>old</text></svg>');
    await Promise.resolve();
    expect(host.textContent).toBe('new');
    expect(host.querySelector('script')).toBeNull();
  });
  test('direct choice buttons include their submitted value', async () => {
    let answer = '';
    renderer({
      actions: {
        answer: (v) => {
          answer = String(v.choice);
          return 'Received';
        },
      },
    }).render(
      '<form data-afm-action="answer"><button name="choice" value="A" type="submit">A</button></form>',
    );
    host.querySelector('form')!.dispatchEvent(
      new browser.SubmitEvent('submit', {
        cancelable: true,
        submitter: host.querySelector('button')!,
      }),
    );
    await Promise.resolve();
    expect(answer).toBe('A');
  });
});

test('fallback preserves task completion and incomplete math retains its last usable checkpoint', () => {
  renderer({ mode: 'plain' }).render('- [x] Complete\n- [ ] Pending');
  expect(host.textContent).toContain('[x]');
  expect(host.textContent).toContain('[ ]');
  const r = renderer();
  r.render('```math\nx^2\n', { streaming: true });
  expect(host.querySelector('.katex')).not.toBeNull();
  const text = host.querySelector('.katex')!.textContent;
  r.render('```math\nx^2\n+ \\frac{\n', { streaming: true });
  expect(host.querySelector('.katex')?.textContent).toBe(text);
});
test('all example stream partitions converge after finalization', () => {
  for (const example of examples) {
    const source = example.source
      .replaceAll('{{START}}', '2026-09-15T10:00:00Z')
      .replaceAll('{{DEADLINE}}', '2026-09-15T10:00:00Z');
    const r = renderer({ live: false });
    for (let i = 0; i < source.length; i += 7) r.render(source.slice(0, i), { streaming: true });
    r.render(source);
    const actual = host.textContent;
    const other = document.createElement('div');
    const one = new AFMRenderer(other, { live: false });
    one.render(source);
    expect(actual).toBe(other.textContent);
    one.dispose();
    r.dispose();
  }
}, 30_000); // Exercises every seven-character prefix of the full example corpus.
test('Mermaid adapter rejects source-controlled configuration before invoking a browser engine', async () => {
  const { renderDiagram } = await import('../src/diagrams');
  for (const source of [
    '%%{init:{}}%%\nflowchart LR\nA-->B',
    'flowchart LR\nclassDef default fill:red',
    'flowchart LR\nA@{ img: "https://example.org/a.png" }',
    'unknownDiagram\nA',
  ])
    await expect(renderDiagram(source)).rejects.toThrow();
});
test('a failed Mermaid checkpoint preserves the previous valid diagram', async () => {
  const r = renderer({
    diagram: async (source) => {
      if (source.includes('invalid')) throw new Error('Incomplete');
      return '<svg><text>valid</text></svg>';
    },
    diagramStreaming: 'checkpoints',
  });
  r.render('```mermaid\nflowchart LR\nA-->B\n', { streaming: true });
  await new Promise((r) => setTimeout(r, 120));
  expect(host.textContent).toBe('valid');
  r.render('```mermaid\nflowchart LR\nA-->B\ninvalid\n', { streaming: true });
  await new Promise((r) => setTimeout(r, 120));
  expect(host.textContent).toBe('valid');
  r.render('```mermaid\nflowchart LR\nA-->B\ninvalid\n```');
  await new Promise((r) => setTimeout(r, 10));
  expect(host.textContent).toBe('Diagram could not be rendered.');
});
test('escaped disclosure markers and tab-indented aliases keep their contexts', () => {
  renderer().render('- \\[-] Literal\n\n> Alias\n\tBody\n\n```text\n> Header\n    child\n```');
  expect(host.querySelectorAll('details')).toHaveLength(1);
  expect(host.querySelector('details')?.textContent).toContain('Body');
  expect(host.textContent).toContain('[-] Literal');
});

test('streaming reveals each text character while withholding incomplete syntax', () => {
  const r = renderer();
  for (const [source, expected, tag] of [
    ['Hello', 'Hello', 'p'],
    ['Hello **world', 'Hello world', 'strong'],
    ['Use `hello', 'Use hello', 'code'],
    ['Visit [a page](https://exam', 'Visit a page', 'p'],
    ['A ==highlight', 'A highlight', 'mark'],
    ['A ||secret', 'A secret', 'spoiler'],
  ] as const) {
    for (let length = 1; length <= source.length; length++)
      r.render(source.slice(0, length), { streaming: true });
    expect(host.textContent?.trim()).toBe(expected);
    expect(host.querySelector(tag)).not.toBeNull();
  }
  for (const tail of ['*', '**', '[', '[x](', '<span title="', '\\']) {
    r.render('Ready ' + tail, { streaming: true });
    expect(host.textContent?.trim()).not.toContain(tail);
  }
  r.render('A **complete** ending');
  expect(host.querySelector('strong')?.textContent).toBe('complete');
});

test('diff hunk content resembling a file header stays code, with correct line numbers', () => {
  const patch = '--- a/test.ts\n+++ b/test.ts\n@@ -48,2 +48,2 @@\n--- old\n+++ new\n context\n';
  renderer().render('```diff\n' + patch + '```');
  expect(host.querySelectorAll('.afm-diff')).toHaveLength(1);
  expect(host.querySelector('.diff-heading')?.textContent).toBe('test.ts+1 −1');
  expect(host.querySelector('.removed .line-code')?.textContent).toBe('--- old');
  expect(host.querySelector('.added .line-code')?.textContent).toBe('+++ new');
  expect(host.querySelector('.context td:nth-child(2)')?.textContent).toBe('49');
  expect(host.querySelector('.diff-source code')?.textContent).toBe(patch);
  renderer({ mode: 'plain' }).render('```diff\n' + patch + '```');
  expect(host.querySelector('pre code')?.textContent).toBe(patch);
});

test('baseline uses ordinary Markdown rules and strips rich HTML, without AFM interpretation', async () => {
  const { renderBaseline } = await import('../src/baseline');
  host.innerHTML = renderBaseline(
    '__bold__ ==literal==\n\n- [-] Summary\n\n<section data-afm-type="card"><p>Readable</p></section><iframe>Hidden preview</iframe><form><button>Hidden action</button></form>',
  );
  expect(host.querySelector('strong')?.textContent).toBe('bold');
  expect(host.querySelector('u')).toBeNull();
  expect(host.textContent).toContain('==literal==');
  expect(host.textContent).toContain('[-] Summary');
  expect(host.textContent).toContain('Readable');
  expect(host.textContent).not.toContain('Hidden');
  expect(host.querySelector('section,iframe,form,button,[data-afm-type]')).toBeNull();
});

test('delimiter pairing respects code, escapes and underscore word boundaries', () => {
  renderer().render('foo__bar__baz __word__ (__punctuation__) __bold **inside**__ `__code__`');
  expect(Array.from(host.querySelectorAll('u')).map((n) => n.textContent)).toEqual([
    'word',
    'punctuation',
    'bold inside',
  ]);
  expect(host.textContent).toContain('foo__bar__baz');
  renderer().render('||a `||` b|| ==a `==` b== ~a `~` b~ ~~a `~~` b~~');
  expect(host.querySelector('spoiler')?.textContent).toBe('a || b');
  expect(host.querySelector('mark')?.textContent).toBe('a == b');
  expect(Array.from(host.querySelectorAll('s')).map((n) => n.textContent)).toEqual([
    'a ~ b',
    'a ~~ b',
  ]);
  renderer().render(
    '\\_\\_literal\\_\\_ [__label__](https://example.org/__path__)\n\n```text\n__code__ ||code||\n```',
  );
  expect(host.querySelector('a u')?.textContent).toBe('label');
  expect(host.querySelector('a')?.getAttribute('href')).toContain('__path__');
  expect(host.querySelector('pre code')?.textContent).toBe('__code__ ||code||\n');
});

test('streaming does not underline intraword underscores or expose partial tags', () => {
  const r = renderer();
  const source = 'foo__bar__baz';
  for (let i = 1; i <= source.length; i++) {
    r.render(source.slice(0, i), { streaming: true });
    expect(host.querySelector('u')).toBeNull();
  }
  const html =
    '<details open><summary>Read</summary><p>Result <b title="a > b">done</b></p></details>';
  for (let i = 1; i <= html.length; i++) {
    r.render(html.slice(0, i), { streaming: true });
    expect(host.textContent).not.toMatch(/[<>]/);
  }
  r.render(html);
  expect(host.textContent).toBe('ReadResult done');
});

test('user expansion survives a growing summary with and without explicit identity', () => {
  for (const id of ['', ' id="work"']) {
    const r = renderer();
    r.render('<details' + id + '><summary>Re', { streaming: true });
    (host.querySelector('details') as HTMLDetailsElement).open = true;
    r.render('<details' + id + '><summary>Reading files', { streaming: true });
    expect(host.querySelector('details')?.open).toBe(true);
  }
});

test('media is complete, user-controlled and retains playback node identity on appends', () => {
  const r = renderer();
  const media =
    '<video id="clip" autoplay src="media/review.mp4"><source src="media/review.mp4" type="video/mp4"></video>';
  r.render(media.slice(0, -8), { streaming: true });
  expect(host.querySelector('video')).toBeNull();
  r.render(media, { streaming: true });
  const video = host.querySelector('video')!;
  expect(video.hasAttribute('autoplay')).toBe(false);
  expect(video.hasAttribute('controls')).toBe(true);
  expect(video.preload).toBe('none');
  r.render(media + '\n\nMore text', { streaming: true });
  expect(host.querySelector('video')).toBe(video);
  renderer({ mode: 'plain' }).render(media + '\n\n[Download video](media/review.mp4)');
  expect(host.querySelector('video')).toBeNull();
  expect(host.querySelector('a')?.textContent).toBe('Download video');
});

test('incomplete HTML entities and empty disclosure scaffolding stay hidden', () => {
  const r = renderer();
  r.render('<details open><summary>', { streaming: true });
  expect(host.querySelector('details')).toBeNull();
  for (const suffix of ['&', '&a', '&am', '&amp']) {
    r.render('<p>A ' + suffix, { streaming: true });
    expect(host.textContent).toBe('A ');
  }
  r.render('<p>A &amp; B', { streaming: true });
  expect(host.textContent).toBe('A & B');
  r.render('`<span title="partial', { streaming: true });
  expect(host.querySelector('code')?.textContent).toBe('<span title="partial');
});

test('streaming respects indented code in top-level, list and disclosure contexts', () => {
  const r = renderer();
  for (const source of [
    '    <span title="partial',
    '- Item\n\n      <span title="partial',
    '> Read\n    Body\n\n        <span title="partial',
  ]) {
    r.render(source, { streaming: true });
    expect(host.querySelector('pre code')?.textContent).toContain('<span title="partial');
    expect(host.querySelector('pre span')).toBeNull();
  }
});

test('optional native IDs are scoped with labels, ARIA and local links across documents', () => {
  const source =
    '<form data-afm-action="answer"><label for="choice">Answer</label><input id="choice" name="choice" aria-describedby="help"><p id="help">Description</p></form><a href="#help">Help</a>';
  const first = document.createElement('div');
  const second = document.createElement('div');
  const a = new AFMRenderer(first);
  const b = new AFMRenderer(second);
  instances.push(a, b);
  a.render(source);
  b.render(source);
  expect(first.querySelector('input')!.id).not.toBe(second.querySelector('input')!.id);
  for (const root of [first, second]) {
    expect(root.querySelector('label')!.htmlFor).toBe(root.querySelector('input')!.id);
    expect(root.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      root.querySelector('p')!.id,
    );
    expect(root.querySelector('a')!.getAttribute('href')).toBe('#' + root.querySelector('p')!.id);
  }
});

test('forms validate, retain retry errors on append and succeed without authored IDs', async () => {
  let calls = 0;
  const r = renderer({
    actions: {
      answer: () => {
        if (++calls === 1) throw new Error('Offline');
        return 'Saved';
      },
    },
  });
  const source =
    '<form data-afm-action="answer"><input name="answer" required><button type="submit">Send</button></form>';
  r.render(source);
  const submit = () =>
    host
      .querySelector('form')!
      .dispatchEvent(new browser.SubmitEvent('submit', { cancelable: true }));
  submit();
  await Promise.resolve();
  expect(calls).toBe(0);
  const input = host.querySelector('input')!;
  input.value = 'Yes';
  input.dispatchEvent(new Event('input'));
  submit();
  await Promise.resolve();
  expect(calls).toBe(1);
  expect(host.textContent).toContain('Offline');
  r.render(source + '\n\nMore');
  expect(host.textContent).toContain('Offline');
  expect(host.querySelector('input')!.value).toBe('Yes');
  submit();
  await Promise.resolve();
  expect(calls).toBe(2);
  expect(host.textContent).toContain('Saved');
  submit();
  await Promise.resolve();
  expect(calls).toBe(2);
});

test('standalone actions preserve authored disabling, pending and completed state across snapshots', async () => {
  let calls = 0;
  let resolve!: (s: string) => void;
  const r = renderer({
    actions: {
      save: () => {
        calls++;
        return new Promise<string>((r) => (resolve = r));
      },
    },
  });
  r.render('<button data-afm-action="save" disabled>Save</button>');
  host.querySelector('button')!.click();
  expect(calls).toBe(0);
  const source = '<button data-afm-action="save">Save</button>';
  r.render(source);
  host.querySelector('button')!.click();
  r.render(source + '\n\nMore');
  host.querySelector('button')!.click();
  expect(calls).toBe(1);
  expect(host.querySelector('button')!.disabled).toBe(true);
  resolve('Saved');
  await Promise.resolve();
  expect(host.querySelector('button')!.textContent).toBe('Saved');
  r.render(source + '\n\nEven more');
  expect(host.querySelector('button')!.textContent).toBe('Saved');
  expect(host.querySelector('button')!.disabled).toBe(true);
});

test('reset disposes widgets immediately and rejects stale button completion', async () => {
  let resolve!: (s: string) => void;
  let cleaned = 0;
  const r = renderer({
    actions: { save: () => new Promise<string>((r) => (resolve = r)) },
    widgets: {
      'example:widget': () => () => {
        cleaned++;
      },
    },
  });
  const source =
    '<section data-afm-type="example:widget">Widget</section><button data-afm-action="save">Save</button>';
  r.render(source);
  host.querySelector('button')!.click();
  r.reset();
  expect(cleaned).toBe(1);
  expect(host.textContent).toBe('');
  r.render(source);
  resolve('Stale');
  await Promise.resolve();
  expect(host.querySelector('button')!.textContent).toBe('Save');
});

test('interrupted streams retain a safe prefix without enabling actions or ticking unfinished timers', () => {
  const r = renderer({ actions: { save: () => 'Done' } });
  r.render(
    'Working<time datetime="2026-01-01T00:00:00Z" data-afm-format="elapsed"></time> <button data-afm-action="save">Save</button> <span title="unfinished',
    { interrupted: true },
  );
  expect(host.textContent?.trim()).toBe('Working Save');
  expect(host.querySelector('button')!.disabled).toBe(true);
  expect(host.querySelector('time')!.textContent).toBe('');
});

test('pending active time is fixed and unknown activity states never imply a running timer', () => {
  const r = renderer();
  r.render(
    '<span data-afm-state="pending"><time data-afm-format="active" data-afm-elapsed="12" datetime="2026-01-01T00:00:00Z"></time></span>',
  );
  expect(host.textContent).toContain('12s active');
  r.render(
    '<span data-afm-state="example:unknown"><time data-afm-format="elapsed" datetime="2026-01-01T00:00:00Z"></time></span>',
  );
  expect(host.textContent?.trim()).toBe('');
  r.render('Price $ 20', { streaming: true });
  expect(host.textContent).toContain('Price $ 20');
});

test('portable hand-authored grammar fixtures match the draft and recorded baseline differences', async () => {
  const fixtures = (await Bun.file(new URL('./fixtures/grammar.json', import.meta.url)).json()) as {
    name: string;
    source: string;
    html: string;
    baselineHTML?: string;
  }[];
  const { renderBaseline } = await import('../src/baseline');
  for (const fixture of fixtures) {
    expect(renderHTML(fixture.source), fixture.name).toBe(fixture.html);
    if (fixture.baselineHTML)
      expect(renderBaseline(fixture.source), fixture.name).toBe(fixture.baselineHTML);
  }
});

test('file line destinations survive rich, plain and baseline rendering without new markup', async () => {
  const { renderBaseline } = await import('../src/baseline');
  const source =
    '[SPEC.md:10](/workspace/project/SPEC.md:10)\n\n[Source](./src/renderer.ts:42)\n\n[Notes](</workspace/Design notes.md:12>)\n\n<a href="../file.ts:7">HTML source</a>\n\n[Remote](https://example.org:8443/file.ts#L42)';
  const expected = [
    '/workspace/project/SPEC.md:10',
    './src/renderer.ts:42',
    '/workspace/Design%20notes.md:12',
    '../file.ts:7',
    'https://example.org:8443/file.ts#L42',
  ];
  for (const mode of ['rich', 'plain'] as const) {
    renderer({ mode }).render(source);
    expect(Array.from(host.querySelectorAll('a')).map((n) => n.getAttribute('href'))).toEqual(
      expected,
    );
  }
  host.innerHTML = renderBaseline(source);
  expect(Array.from(host.querySelectorAll('a')).map((n) => n.getAttribute('href'))).toEqual(
    expected,
  );
  const r = renderer();
  const stream = '[SPEC.md:10](/workspace/project/SPEC.md:10)';
  for (let i = 1; i <= stream.length; i++) {
    r.render(stream.slice(0, i), { streaming: true });
    expect(host.querySelector('a[href]')).toBeNull();
    expect(host.textContent).not.toContain('/workspace');
  }
  r.render(stream);
  expect(host.querySelector('a')?.getAttribute('href')).toBe(expected[0]);
  expect(host.querySelector('a')?.textContent).toBe('SPEC.md:10');
});

test('file URLs survive Markdown and HTML rendering and remain inactive while streaming', () => {
  const source =
    '[Source](file:///workspace/src/renderer.ts:42)\n\n[Notes](<file:///workspace/Design notes.md:12>)\n\n<a href="file:///workspace/README.md">Readme</a>\n\n<FILE:///workspace/SPEC.md>';
  const expected = [
    'file:///workspace/src/renderer.ts:42',
    'file:///workspace/Design%20notes.md:12',
    'file:///workspace/README.md',
    'FILE:///workspace/SPEC.md',
  ];
  for (const mode of ['rich', 'plain'] as const) {
    renderer({ mode }).render(source);
    expect(Array.from(host.querySelectorAll('a')).map((n) => n.getAttribute('href'))).toEqual(
      expected,
    );
  }
  const r = renderer();
  const stream = '[Source](file:///workspace/src/renderer.ts:42)';
  for (let i = 1; i <= stream.length; i++) {
    r.render(stream.slice(0, i), { streaming: true });
    expect(host.querySelector('a[href]')).toBeNull();
  }
  r.render(stream);
  expect(host.querySelector('a')?.getAttribute('href')).toBe(expected[0]);
  host.innerHTML = renderHTML(
    '<a href="javascript:alert(1)">a</a><a href="java&#x09;script:alert(1)">b</a><a href="vbscript:msgbox(1)">c</a><a href="data:text/html,bad">d</a>',
  );
  expect(host.querySelector('a[href]')).toBeNull();
});

test('opening work trace composes nested tools, commands, patches, live headers and a footer', async () => {
  const source = examples
    .find((e) => e.id === 'overview')!
    .source.replaceAll('{{START}}', new Date(Date.now() - 17000).toISOString());
  renderer().render(source);
  expect(host.querySelector('details details details details')).not.toBeNull();
  expect(host.querySelectorAll('.afm-diff')).toHaveLength(2);
  expect(host.querySelectorAll('pre code.language-sh')).toHaveLength(3);
  expect(host.querySelectorAll('.afm-running')).toHaveLength(3);
  expect(host.querySelectorAll('.afm-activity-icon')).toHaveLength(4);
  expect(host.querySelectorAll('time[role=timer]')).toHaveLength(2);
  expect(host.querySelector('footer')?.textContent).toBe('2 files changed · Review in progress');
  expect(host.querySelector('mark,spoiler,.footnotes')).toBeNull();
  const { renderBaseline } = await import('../src/baseline');
  host.innerHTML = renderBaseline(source);
  expect(host.textContent).toContain('Improving streaming');
  expect(host.textContent).toContain('git diff --check');
  expect(host.textContent).toContain('2 files changed · Review in progress');
});

test('running headers animate independently; other states, replay and interruption stay static', () => {
  const r = renderer();
  for (const state of [
    'pending',
    'running',
    'waiting',
    'paused',
    'completed',
    'failed',
    'cancelled',
    'unknown',
  ]) {
    r.render(
      `<details open data-afm-kind="execute" data-afm-state="${state}"><summary>Run tests</summary><details data-afm-kind="read"><summary>Read output</summary>Text</details></details>`,
    );
    expect(host.querySelectorAll('.afm-running')).toHaveLength(state === 'running' ? 1 : 0);
    expect(host.querySelector('details details .afm-running')).toBeNull();
    expect(host.querySelectorAll('svg[aria-hidden=true][focusable=false]')).toHaveLength(2);
    expect(host.querySelector('summary')?.textContent).toBe('Run tests');
  }
  const source =
    '<span data-afm-type="activity" data-afm-kind="think" data-afm-state="running">Thinking</span>';
  r.render(source);
  expect(host.querySelector('.afm-running')?.textContent).toBe('Thinking');
  r.render(source, { interrupted: true });
  expect(host.querySelector('.afm-running')).toBeNull();
  renderer({ live: false }).render(source);
  expect(host.querySelector('.afm-running')).toBeNull();
  renderer({ mode: 'plain' }).render(source);
  expect(host.querySelector('.afm-activity-icon,.afm-running')).toBeNull();
  expect(host.textContent?.trim()).toBe('Thinking');
  for (const kind of ['example:custom', 'constructor']) {
    r.render(`<details data-afm-kind="${kind}"><summary>Custom tool</summary></details>`);
    expect(host.querySelector('.afm-activity-icon')).toBeNull();
  }
});

test('footer text, formatting and links survive rich, plain and standard Markdown fallback', async () => {
  const source = '<footer>\n\nReviewed by **Mina** · [Changes](./changes.md)\n\n</footer>';
  for (const mode of ['rich', 'plain'] as const) {
    renderer({ mode }).render(source);
    expect(host.querySelector('footer strong')?.textContent).toBe('Mina');
    expect(host.querySelector('footer a')?.getAttribute('href')).toBe('./changes.md');
  }
  const { renderBaseline } = await import('../src/baseline');
  host.innerHTML = renderBaseline(source);
  expect(host.textContent).toContain('Reviewed by Mina · Changes');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('./changes.md');
});

const latestGroup = (body: string, attributes = '') =>
  `<details id="work" data-afm-type="activity" data-afm-summary="latest" ${attributes}><summary>Working</summary>\n\n${body}\n\n</details>`;
const childActivity = (label: string) =>
  `<span data-afm-type="activity" data-afm-kind="execute">${label}</span>`;

test('latest activity summary follows child order in both expansion states, preserving fallback', async () => {
  const r = renderer();
  r.render(latestGroup(''));
  expect(host.querySelector('summary')?.textContent).toBe('Working');
  const body =
    childActivity('Read files') +
    '\n\n' +
    childActivity('Run checks') +
    '\n\n<footer>Do not promote metadata</footer>';
  r.render(latestGroup(body));
  const group = host.querySelector('details')!;
  expect(group.open).toBe(false);
  expect(group.querySelector('summary')?.textContent).toBe('Run checks');
  group.open = true;
  r.render(latestGroup(body + '\n\n' + childActivity('Inspect results')));
  expect(host.querySelector('details')?.open).toBe(true);
  expect(host.querySelector('summary')?.textContent).toBe('Inspect results');
  expect(host.querySelector('summary .afm-activity-icon')).not.toBeNull();
  r.render(latestGroup(childActivity('Read files')));
  expect(host.querySelector('summary')?.textContent).toBe('Read files');
  r.render(latestGroup(''));
  expect(host.querySelector('summary')?.textContent).toBe('Working');
  const source = latestGroup(body);
  renderer({ mode: 'plain' }).render(source);
  expect(host.textContent).toContain('Working');
  expect(host.textContent?.match(/Run checks/g)).toHaveLength(1);
  const { renderBaseline } = await import('../src/baseline');
  host.innerHTML = renderBaseline(source);
  expect(host.textContent).toContain('Working');
  expect(host.textContent?.match(/Run checks/g)).toHaveLength(1);
  r.render(source.replace('data-afm-summary="latest"', 'data-afm-summary="unknown"'));
  expect(host.querySelector('summary')?.textContent).toBe('Working');
});

test('latest group streams the same safe label as its child, without promoting unfinished tags', () => {
  const r = renderer();
  const prefix = latestGroup(childActivity('Read files')).replace(/<\/details>$/, '');
  const next =
    '\n\n<details data-afm-kind="execute"><summary>**Run checks**</summary>\n\n```sh\ncommand output\n```\n\n</details>';
  for (let i = 0; i <= next.length; i++) {
    r.render(prefix + next.slice(0, i), { streaming: true });
    const summaries = host.querySelectorAll('summary');
    const child = summaries[1]?.textContent?.trim();
    expect(summaries[0]?.textContent).toBe(child || 'Read files');
    expect(summaries[0]?.textContent).not.toContain('command output');
    expect(summaries[0]?.textContent).not.toContain('<');
  }
});

test('latest groups select direct rows through lists and compose nested projections, never result bodies', () => {
  const r = renderer();
  r.render(
    latestGroup(
      '- <details><summary>Run checks</summary>\n\n  - [-] Output detail\n      Not the group label.\n\n  </details>',
    ),
  );
  expect(host.querySelector('summary')?.textContent).toBe('Run checks');
  r.render(
    latestGroup(
      '- <details data-afm-summary="latest"><summary>Review</summary>\n\n  - [-] Read sources\n      More output.\n\n  </details>',
    ),
  );
  expect(host.querySelector('summary')?.textContent).toBe('Read sources');
  r.render(
    latestGroup(
      '- [-] Markdown child\n    Output\n\n<section>' +
        childActivity('Widget content') +
        '</section>',
    ),
  );
  expect(host.querySelector('summary')?.textContent).toBe('Markdown child');
  r.render(
    examples
      .find((e) => e.id === 'latest-activity')!
      .source.replaceAll('{{START}}', new Date().toISOString()),
  );
  expect(host.querySelectorAll('li.activity-item')).toHaveLength(2);
});

test('projected headers retain formatting and spoilers without copying identities or controls', () => {
  const source = latestGroup(
    '<details data-afm-kind="read"><summary><strong id="label">Read</strong> <a href="https://example.org">source</a> <spoiler>secret</spoiler><button>Execute</button><img src="x" alt="image"></summary>Body</details>',
  );
  renderer().render(source);
  const projected = host.querySelector('summary')!;
  expect(projected.querySelector('strong')?.textContent).toBe('Read');
  expect(projected.querySelector('spoiler')?.getAttribute('aria-expanded')).toBe('false');
  expect(projected.querySelector('a,button,img,[id]')).toBeNull();
  expect(projected.textContent).toBe('Read source secret');
  expect(host.querySelectorAll('[id$="-label"]')).toHaveLength(1);
});

test('projected timers keep child state, while shimmer uses independent group state', () => {
  const source = latestGroup(
    '<span data-afm-type="activity" data-afm-state="paused">Paused<time data-afm-format="active" data-afm-elapsed="19"></time></span>',
    'data-afm-state="running"',
  );
  const r = renderer();
  r.render(source);
  expect(host.querySelector('summary')?.textContent).toContain('19s');
  expect(host.querySelector('summary.afm-running')).not.toBeNull();
  expect(host.querySelector<HTMLElement>('summary time')?.dataset.afmState).toBe('paused');
  r.render(source, { interrupted: true });
  expect(host.querySelector('.afm-running')).toBeNull();
  expect(host.querySelector('summary')?.textContent).toContain('19s');
});

test('latest-label updates keep keyboard focus and user expansion on the group', () => {
  const r = renderer();
  r.render(latestGroup(childActivity('Read files')));
  host.querySelector('details')!.open = true;
  host.querySelector('summary')!.focus();
  expect(document.activeElement?.localName).toBe('summary');
  r.render(latestGroup(childActivity('Read files') + '\n\n' + childActivity('Run checks')));
  expect(document.activeElement).toBe(host.querySelector('summary'));
  expect(host.querySelector('details')?.open).toBe(true);
  expect(document.activeElement?.textContent).toBe('Run checks');
});

test('unregistered prototype names cannot resolve to host actions or widgets', () => {
  const r = renderer({ actions: {}, widgets: {} });
  for (const name of ['constructor', 'toString', '__proto__']) {
    r.render(
      `<button data-afm-action="${name}">Run</button><form data-afm-action="${name}"><button>Go</button></form><section data-afm-type="${name}">Widget</section>`,
    );
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('form button')?.disabled).toBe(true);
    expect(host.textContent).toContain('Widget');
  }
});
test('form data has no prototype and clobbering names stay sanitized', async () => {
  let values: Record<string, string | string[]> | undefined;
  renderer({
    actions: {
      save: (input) => {
        values = input;
        return 'Saved';
      },
    },
  }).render(
    '<form data-afm-action="save"><input name="__proto__" value="safe"><input name="constructor" value="label"><input name="choice" value="one"><input name="choice" value="two"><button>Save</button></form>',
  );
  host
    .querySelector('form')!
    .dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  expect(Object.getPrototypeOf(values)).toBeNull();
  expect(values?.['__proto__']).toBeUndefined();
  expect(values?.choice).toEqual(['one', 'two']);
});
test('removed, disposed, and replaced controls cannot deliver stale work', async () => {
  let calls = 0;
  let finish!: (value: string) => void;
  const r = renderer({
    actions: {
      save: () => {
        calls++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  const source = '<button id="save" data-afm-action="save">Save</button>';
  r.render(source);
  const old = host.querySelector('button')!;
  old.click();
  expect(calls).toBe(1);
  r.render('Removed');
  r.render(source);
  finish('Old result');
  await Promise.resolve();
  await Promise.resolve();
  expect(host.querySelector('button')?.textContent).toBe('Save');
  old.disabled = false;
  old.click();
  expect(calls).toBe(1);
  const current = host.querySelector('button')!;
  r.dispose();
  current.disabled = false;
  current.click();
  expect(calls).toBe(1);
});
test('unchanged code, selection, and isolated previews survive title edits', () => {
  const r = renderer();
  const source = (label: string) =>
    `<details id="work" open><summary>${label}</summary>\n\nRetain **selected** text.\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n\n<iframe title="Lab"><p>Preview</p></iframe>\n\n</details>`;
  r.render(source('Working'));
  const p = host.querySelector('p')!,
    pre = host.querySelector('pre')!,
    frame = host.querySelector('iframe')!;
  const selection = browser.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(p);
  selection.addRange(range);
  r.render(source('Completed'));
  expect(host.querySelector('p')).toBe(p);
  expect(host.querySelector('pre')).toBe(pre);
  expect(host.querySelector('iframe')).toBe(frame);
  expect(selection.toString()).toBe('Retain selected text.');
});
test('keyed disclosures move with their bodies and removal clears remembered expansion', () => {
  const r = renderer();
  const row = (id: string) =>
    `<details id="${id}"><summary>${id}</summary><p>Body ${id}</p></details>`;
  r.render(row('a') + row('b'));
  const a = host.querySelector('details')!;
  a.open = true;
  r.render(row('b') + row('a'));
  expect(host.querySelectorAll('details')[1]).toBe(a);
  expect(a.open).toBe(true);
  r.render('Nothing');
  r.render(row('a'));
  expect(host.querySelector('details')?.open).toBe(false);
});
test('repeated hydration keeps one spoiler handler and one action delivery', async () => {
  let calls = 0;
  const r = renderer({
    actions: {
      save: () => {
        calls++;
        return 'Saved';
      },
    },
  });
  const source = '<spoiler>Secret</spoiler>\n\n<button data-afm-action="save">Save</button>';
  for (let i = 0; i < 8; i++) r.render(source + '\n\n' + i);
  host.querySelector<HTMLElement>('spoiler')!.click();
  expect(host.querySelector('spoiler')?.getAttribute('aria-expanded')).toBe('true');
  host.querySelector('button')!.click();
  await Promise.resolve();
  expect(calls).toBe(1);
});

test('source and HTML depth limits reject boundedly before recursive enhancement', () => {
  expect(() => renderer({ maxSourceLength: NaN })).toThrow();
  expect(() => renderer({ maxNestingDepth: 0 })).toThrow();
  const r = renderer({ maxNestingDepth: 8 });
  expect(() => r.render('<div>'.repeat(12) + 'text' + '</div>'.repeat(12))).toThrow(
    'nesting limit',
  );
  r.render('Still usable');
  expect(host.textContent).toContain('Still usable');
  expect(() => renderer({ maxSourceLength: 4 }).render('too long')).toThrow('source exceeds');
});

test('dispose is idempotent and attempts every cleanup even if a host widget throws', () => {
  let cleanups = 0;
  const r = renderer({
    widgets: {
      'test:first': () => () => {
        cleanups++;
        throw new Error('Host cleanup');
      },
      'test:second': () => () => {
        cleanups++;
      },
    },
  });
  r.render(
    '<section data-afm-type="test:first"></section><section data-afm-type="test:second"></section>',
  );
  expect(() => r.dispose()).toThrow('Renderer cleanup failed');
  expect(cleanups).toBe(2);
  expect(() => r.dispose()).not.toThrow();
  expect(() => r.render('After disposal')).toThrow('Renderer disposed');
});

test('quoted angle brackets and HTML entities preserve summary and preview titles', () => {
  const r = renderer();
  r.render('<details><summary title="a > b">**Ready**</summary><p>Body</p></details>');
  expect(host.querySelector('summary strong')?.textContent).toBe('Ready');
  expect(host.querySelector('summary')?.title).toBe('a > b');
  for (const title of ["'Read > write &amp; review'", '"Read > write &amp; review"']) {
    r.render(`<iframe title=${title}><p>Preview body</p></iframe>`);
    const frame = host.querySelector('iframe')!;
    expect(frame.title).toBe('Read > write & review');
    expect(frame.srcdoc).toContain('Preview body');
    expect(frame.getAttribute('sandbox')).toBe('');
  }
  r.render('<iframe title=Lab><p>Preview body</p></iframe>');
  expect(host.querySelector('iframe')?.title).toBe('Lab');
  r.render('<iframe-note>Keep this vendor content</iframe-note>');
  expect(host.textContent).toContain('Keep this vendor content');
  expect(host.querySelector('iframe')).toBeNull();
});
