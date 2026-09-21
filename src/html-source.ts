import { renderHTML } from './parser';

export function htmlSource(source: string) {
  const template = document.createElement('template');
  template.innerHTML = renderHTML(source);
  template.content.querySelectorAll<HTMLElement>('[data-math]').forEach((n) => {
    const code = document.createElement('code');
    code.className = n.dataset.display === 'true' ? 'language-math' : 'math-inline';
    code.textContent = decodeURIComponent(n.dataset.math!);
    if (n.dataset.display === 'true') {
      const pre = document.createElement('pre');
      pre.append(code);
      n.replaceWith(pre);
    } else n.replaceWith(code);
  });
  template.content.querySelectorAll<HTMLElement>('.diff-bundle').forEach((n) => {
    const pre = document.createElement('pre'),
      code = document.createElement('code');
    code.className = 'language-diff';
    code.textContent = decodeURIComponent(n.dataset.patch!);
    pre.append(code);
    n.replaceWith(pre);
  });
  // Present the authored preview document, not the renderer's encoded placeholder.
  template.content.querySelectorAll<HTMLElement>('[data-preview]').forEach((n) => {
    const marker = document.createElement('pre');
    marker.textContent =
      '<iframe title="HTML preview" sandbox>\n' +
      decodeURIComponent(n.dataset.preview!) +
      '\n</iframe>';
    n.replaceWith(marker);
  });
  if (
    template.content.childElementCount === 1 &&
    template.content.firstElementChild?.tagName === 'PRE' &&
    source.trimStart().startsWith('<iframe')
  )
    return template.content.textContent ?? '';
  return template.innerHTML.replace(
    /><(details|summary|section|form|fieldset|legend|button|p|ul|li|footer)/g,
    '>\n<$1',
  );
}
