import { htmlSource } from './html-source';
import { AFMRenderer } from './renderer';
import { renderHTML } from './parser';
import { renderDiagram } from './diagrams';
import { renderBaseline } from './baseline';
import { examples } from './examples';
import { documents, sections } from './content.generated';

const main = document.querySelector<HTMLElement>('#main')!;
const actions = {
  'demo:answer': (v: Record<string, string | string[]>) => {
    if (v.topic === 'Custom' && !String(v.note ?? '').trim()) throw new Error('Enter your answer.');
    return 'Received: ' + (v.topic === 'Custom' ? v.note : v.topic);
  },
  'demo:review': () => 'Reviewed',
  'demo:choice': (v: Record<string, string | string[]>) => 'Selected: ' + v.integration,
};
const dispose: (() => void)[] = [];

function example(id: string, heading = true) {
  const item = examples.find((e) => e.id === id)!;
  const source = item.source
    .replaceAll('{{START}}', new Date(Date.now() - 17000).toISOString())
    .replaceAll('{{DEADLINE}}', new Date(Date.now() + 300000).toISOString());
  const section = document.createElement('section');
  section.className = 'example';
  section.id = id;
  const title = document.createElement('h3');
  title.textContent = item.title;
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = item.description;
  const columns = document.createElement('div');
  columns.className = 'comparison';
  const input = document.createElement('div');
  input.className = 'comparison-side';
  const result = document.createElement('div');
  result.className = 'comparison-side';
  const code = document.createElement('pre');
  code.className = 'source pane';
  code.id = 'source-' + id;
  const output = document.createElement('div');
  output.className = 'pane output';
  output.id = 'output-' + id;
  const inputBar = document.createElement('div');
  inputBar.className = 'toolbar';
  const outputBar = document.createElement('div');
  outputBar.className = 'toolbar';
  let inputMode = 'Markdown',
    outputMode = 'Rendered',
    interval: ReturnType<typeof setInterval> | undefined,
    renderer: AFMRenderer | undefined;
  const stream = document.createElement('button');
  stream.type = 'button';
  stream.textContent = 'Stream';
  function stop() {
    clearInterval(interval);
    interval = undefined;
    stream.textContent = 'Stream';
  }
  function paint(text: string, partial = false) {
    if (outputMode === 'Markdown-it') output.innerHTML = renderBaseline(text);
    else renderer!.render(text, { streaming: partial });
  }
  function switchOutput(name: string) {
    stop();
    outputMode = name;
    renderer?.dispose();
    renderer = undefined;
    output.replaceChildren();
    output.classList.add('afm');
    if (name !== 'Markdown-it')
      renderer = new AFMRenderer(output, {
        actions,
        diagram: renderDiagram,
        diagramStreaming: 'checkpoints',
      });
    paint(source);
    stream.hidden = name !== 'Rendered';
  }
  function tabs(
    bar: HTMLElement,
    names: string[],
    pane: HTMLElement,
    selected: string,
    onSelect: (name: string) => void,
  ) {
    const group = document.createElement('div');
    group.className = 'tabs';
    group.setAttribute('role', 'tablist');
    group.setAttribute('aria-label', item.title + ' ' + pane.id);
    const buttons: HTMLButtonElement[] = [];
    pane.setAttribute('role', 'tabpanel');
    for (const name of names) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.id = 'tab-' + pane.id + '-' + name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', pane.id);
      button.setAttribute('aria-selected', String(name === selected));
      button.tabIndex = name === selected ? 0 : -1;
      if (name === selected) pane.setAttribute('aria-labelledby', button.id);
      button.addEventListener('click', () => {
        buttons.forEach((b) => {
          b.setAttribute('aria-selected', String(b === button));
          b.tabIndex = b === button ? 0 : -1;
        });
        pane.setAttribute('aria-labelledby', button.id);
        onSelect(name);
      });
      button.addEventListener('keydown', (e) => {
        let n = buttons.indexOf(button);
        if (e.key === 'ArrowRight') n = (n + 1) % names.length;
        else if (e.key === 'ArrowLeft') n = (n + names.length - 1) % names.length;
        else return;
        e.preventDefault();
        buttons[n].click();
        buttons[n].focus();
      });
      group.append(button);
      buttons.push(button);
    }
    bar.append(group);
  }
  tabs(inputBar, ['Markdown', 'HTML'], code, inputMode, (name) => {
    inputMode = name;
    code.textContent = name === 'Markdown' ? source : htmlSource(source);
  });
  tabs(outputBar, ['Rendered', 'Markdown-it'], output, outputMode, switchOutput);
  outputBar.append(stream);
  code.textContent = source;
  input.append(inputBar, code);
  result.append(outputBar, output);
  columns.append(input, result);
  stream.addEventListener('click', () => {
    if (interval) {
      stop();
      paint(source);
      return;
    }
    renderer!.reset();
    paint('', true);
    stream.textContent = 'Finish';
    let offset = 0;
    interval = setInterval(() => {
      offset = Math.min(source.length, offset + 3);
      paint(source.slice(0, offset), offset < source.length);
      if (offset === source.length) stop();
    }, 24);
  });
  if (heading) section.append(title, note);
  section.append(columns);
  switchOutput(outputMode);
  dispose.push(() => {
    stop();
    renderer?.dispose();
  });
  return section;
}
function documentBody(markdown: string, origin = 'SPEC.md') {
  const body = document.createElement('div');
  body.className = 'document afm';
  body.innerHTML = renderHTML(markdown);
  const localSections: Record<string, string> = {
    'docs/semantics.md#inline-formatting': 'formatting-rules',
    'docs/semantics.md#disclosures-and-mixed-content': 'disclosure-rules',
    'docs/semantics.md#attributes-and-identity': 'attributes',
    'docs/semantics.md#file-links-and-line-locations': 'file-links-rules',
    // The summary's final link opens the full list, not the summary itself.
    'FUTURE.md': origin === 'site/future.md' ? '' : 'future',
  };
  const exampleAnchors = new Map(
    examples.map((item) => [
      '#' +
        item.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s/g, '-'),
      item.id,
    ]),
  );
  body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href')!;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return;
    const resolved = new URL(href, 'https://afm.invalid/' + origin);
    const path = resolved.pathname.slice(1);
    const section =
      path === 'EXAMPLES.md'
        ? exampleAnchors.get(resolved.hash)
        : localSections[path + resolved.hash];
    link.setAttribute('href', section ? '#' + section : 'spec/' + path + resolved.hash);
  });
  return body;
}
const intro = documentBody(documents.spec.split('\n## ')[0]);
intro.id = 'spec';
intro.querySelector('h1')?.remove();
main.append(intro);
const contents = document.createElement('nav');
contents.className = 'contents';
contents.setAttribute('aria-label', 'Contents');
for (const [id, title] of [
  ['overview', 'Example'],
  ['syntax', 'Syntax'],
  ['disclosure-rules', 'Disclosures'],
  ['activity-rules', 'Activity'],
  ['interaction-rules', 'Forms'],
  ['content-rules', 'Content'],
  ['streaming', 'Streaming'],
  ['attributes', 'Attributes'],
  ['implementation', 'Implementation'],
  ['future', 'Future'],
] as const) {
  const link = document.createElement('a');
  link.href = '#' + id;
  link.textContent = title;
  contents.append(link);
}
function appendDocument(id: string, title: string, markdown: string, origin = 'SPEC.md') {
  const section = document.createElement('section');
  section.id = id;
  section.className = 'spec-section';
  const h = document.createElement('h2');
  const anchor = document.createElement('a');
  anchor.href = '#' + id;
  anchor.textContent = title;
  h.append(anchor);
  section.append(h, documentBody(markdown, origin));
  main.append(section);
  return section;
}
for (const item of sections) {
  const section = appendDocument(item.id, item.title, item.markdown, item.source);
  const body = section.lastElementChild!;
  for (const id of item.examples) {
    const preview = example(id, item.examples.length > 1);
    if (id === item.id) preview.removeAttribute('id');
    section.insertBefore(preview, body);
  }
  if (item.id === 'overview') main.append(contents);
}
appendDocument(
  'implementation',
  'Implementation',
  documents.implementation,
  'guidelines/implementation.md',
);
appendDocument('future', 'Future proposals', documents.future, 'site/future.md');
const references = document.createElement('p');
references.className = 'references';
references.innerHTML =
  'Inspired by <a href="https://github.github.com/gfm/">GFM</a>, <a href="https://core.telegram.org/bots/api#formatting-options">Telegram</a>, <a href="https://help.obsidian.md/syntax">Obsidian</a>, and <a href="https://github.com/nodes-app/swift-markdown-engine">Nodes</a>.';
main.append(references);
const jump = () => {
  const id = location.hash.slice(1).replace(/^examples\//, '');
  if (!id || id === 'spec') {
    window.scrollTo(0, 0);
    return;
  }
  document.getElementById(id)?.scrollIntoView();
};
window.addEventListener('hashchange', jump);
requestAnimationFrame(jump);
window.addEventListener('pagehide', () => dispose.forEach((f) => f()), { once: true });
