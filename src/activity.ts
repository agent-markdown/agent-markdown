/** Reference header presentation; source still uses ordinary summaries and text. */
const icons: Record<string, string> = {
  read: 'M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H3z M21 4h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h5z',
  edit: 'm16 3 5 5-12 12-6 1 1-6z M13 6l5 5',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  execute:
    'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M7 8l4 4-4 4 M13 16h4',
  think: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  fetch:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M2 12h20 M12 2c-6 5-6 15 0 20 M12 2c6 5 6 15 0 20',
  agent:
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M2 21v-2a7 7 0 0 1 14 0v2 M17 4a4 4 0 0 1 0 8 M22 21v-2a7 7 0 0 0-4-6',
  system: 'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
};

const rowSelector = 'details,span[data-afm-type="activity"]';
const wrappers = new Set(['ul', 'ol', 'li', 'p']);
const inlineTags = new Set([
  'span',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'mark',
  'code',
  'sub',
  'sup',
  'spoiler',
  'time',
  'br',
]);
const omittedTags = new Set([
  'input',
  'button',
  'select',
  'textarea',
  'img',
  'svg',
  'audio',
  'video',
  'form',
]);

/** Copy a public label, never navigation, identity, controls, or a tool's output. */
function copyLabel(source: Node, target: Node, state?: string) {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(child.cloneNode());
      continue;
    }
    if (!(child instanceof HTMLElement) || child.hidden || omittedTags.has(child.localName))
      continue;
    if (!inlineTags.has(child.localName)) {
      copyLabel(child, target, state);
      continue;
    }
    const copy = document.createElement(child.localName);
    if (child.localName === 'time') {
      for (const attr of ['datetime', 'data-afm-format', 'data-afm-end', 'data-afm-elapsed']) {
        if (child.hasAttribute(attr)) copy.setAttribute(attr, child.getAttribute(attr)!);
      }
      const timerState = child.closest('[data-afm-state]')?.getAttribute('data-afm-state') ?? state;
      // An empty explicit state prevents a projected timer inheriting the group's state.
      copy.setAttribute('data-afm-state', timerState ?? '');
    }
    copyLabel(child, copy, state);
    target.appendChild(copy);
  }
}

/** Derive group headers bottom-up, without rewriting authored summaries or child rows. */
export function projectLatestSummaries(root: HTMLElement) {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(rowSelector));
  const latest = new Map<HTMLElement, HTMLElement>();
  const kinds = new Map<HTMLElement, string>();
  for (const row of rows) {
    let parent = row.parentElement;
    while (parent && wrappers.has(parent.localName)) parent = parent.parentElement;
    if (parent?.localName !== 'details' || parent.dataset.afmSummary !== 'latest') continue;
    const label = row.localName === 'details' ? row.querySelector(':scope > summary') : row;
    if (!label) continue;
    const visible = document.createElement('span');
    copyLabel(label, visible);
    if (visible.textContent?.trim()) latest.set(parent, row);
  }
  for (const row of rows.reverse()) {
    const child = latest.get(row);
    const summary = row.querySelector<HTMLElement>(':scope > summary');
    const label = child?.localName === 'details' ? child.querySelector(':scope > summary') : child;
    if (!child || !summary || !label) continue;
    const projection = document.createDocumentFragment();
    copyLabel(label, projection, child.dataset.afmState);
    summary.replaceChildren(projection);
    kinds.set(row, kinds.get(child) ?? child.dataset.afmKind ?? '');
  }
  return kinds;
}

export function decorateActivity(
  root: HTMLElement,
  live: boolean,
  projectedKinds = new Map<HTMLElement, string>(),
) {
  root
    .querySelectorAll<HTMLElement>(
      'details[data-afm-state],details[data-afm-kind],details[data-afm-summary="latest"],[data-afm-type="activity"]',
    )
    .forEach((node) => {
      const header =
        node.localName === 'details'
          ? node.querySelector<HTMLElement>(':scope > summary')
          : node.localName === 'span'
            ? node
            : null;
      if (!header) return;
      header.classList.add('afm-activity-header');
      const running = live && node.dataset.afmState === 'running';
      if (running) header.classList.add('afm-running');
      const label = document.createElement('span');
      label.className = 'afm-activity-label';
      // Keep the sweep's phase when snapshot rendering replaces the header.
      if (running) label.style.animationDelay = `-${Math.round(performance.now())}ms`;
      label.append(...Array.from(header.childNodes));
      header.append(label);
      const kind = projectedKinds.get(node) ?? node.dataset.afmKind ?? '';
      const path = Object.hasOwn(icons, kind) ? icons[kind] : undefined;
      if (!path) return;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.classList.add('afm-activity-icon');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      const shape = document.createElementNS(icon.namespaceURI, 'path');
      shape.setAttribute('d', path);
      icon.append(shape);
      header.prepend(icon);
    });
}
