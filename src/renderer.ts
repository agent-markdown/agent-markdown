import DOMPurify from 'dompurify';
import katex from 'katex';
import { md, renderHTML } from './parser';
import { displayPrefix, markdownCheckpoint } from './streaming';
import { decorateActivity, projectLatestSummaries } from './activity';
import { bindTimers } from './timers';
import { ActionController } from './actions';
import { reconcile } from './reconcile';
import type { RendererOptions, RenderState } from './types';
export type { Action, RendererOptions, RenderState } from './types';

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

let documentSequence = 0;
export class AFMRenderer {
  private lastSnapshot = '';
  private appeared = new Set<string>();
  private documentId = `afm${++documentSequence}`;
  private cleanup: (() => void)[] = [];
  private expansion = new Map<string, boolean>();
  private revision = 0;
  private math = new Map<HTMLElement, { source: string; html: string }>();
  private diagrams = new Map<HTMLElement, { source: string; svg: string }>();
  private actions = new ActionController();
  private disposed = false;
  private epoch = 0;
  constructor(
    readonly element: HTMLElement,
    readonly options: RendererOptions = {},
  ) {
    for (const limit of [options.maxSourceLength, options.maxNestingDepth]) {
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
        throw new RangeError('Renderer limits must be positive safe integers');
    }
    element.classList.add('afm');
  }
  reset() {
    if (this.disposed) throw new Error('Renderer disposed');
    this.revision++;
    this.element.replaceChildren();
    this.lastSnapshot = '';
    this.diagrams.clear();
    this.math.clear();
    this.appeared.clear();
    this.epoch++;
    this.expansion.clear();
    this.actions.reset();
    this.release();
  }
  render(source: string, state: RenderState = {}) {
    if (this.disposed) throw new Error('Renderer disposed');
    // An interrupted stream keeps its safe prefix; it is not a completed action document.
    if (state.interrupted) state = { ...state, streaming: true };
    if (source.length > (this.options.maxSourceLength ?? 250_000))
      throw new Error('AFM source exceeds renderer limit');
    if (state.streaming) {
      // Let the block parser identify literal code; indentation alone is ambiguous in lists/aliases.
      const blocks: ReturnType<typeof md.parse> = [];
      md.block.parse(source, md, {}, blocks);
      const lines = [0, ...Array.from(source.matchAll(/\n/g), (m) => m.index! + 1)];
      const literals = blocks
        .filter((t) => (t.type === 'code_block' || t.type === 'fence') && t.map)
        .map((t) => [lines[t.map![0]], lines[t.map![1]] ?? source.length] as const);
      source = markdownCheckpoint(
        displayPrefix(source, literals),
        this.options.diagramStreaming === 'checkpoints',
      );
    }
    const snapshot = JSON.stringify([source, Boolean(state.streaming), Boolean(state.interrupted)]);
    if (snapshot === this.lastSnapshot) return;
    const mode = this.options.mode ?? 'rich';
    const html = renderHTML(source, mode, {
      ...state,
      diagrams: Boolean(this.options.diagram) && mode !== 'plain',
      docId: this.documentId,
      maxNestingDepth: this.options.maxNestingDepth,
    });
    const revision = ++this.revision;
    this.element
      .querySelectorAll<HTMLDetailsElement>('details[data-afm-disclosure]')
      .forEach((n) => this.expansion.set(n.dataset.afmDisclosure!, n.open));
    this.lastSnapshot = '';
    this.release();
    this.lastSnapshot = snapshot;
    const active = document.activeElement;
    const focusedDisclosure =
      active?.localName === 'summary' && this.element.contains(active)
        ? (active.parentElement as HTMLElement).dataset.afmDisclosure
        : undefined;
    const focused =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement
        ? active
        : undefined;
    const textFocus =
      focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
        ? focused
        : undefined;
    const focus =
      focused && this.element.contains(focused)
        ? {
            key: focused.dataset.afmInput,
            start: textFocus?.selectionStart ?? null,
            end: textFocus?.selectionEnd ?? null,
          }
        : undefined;
    reconcile(this.element, html);
    if (state.streaming)
      this.element.querySelectorAll('details').forEach((n) => {
        const summary = n.querySelector(':scope > summary');
        if (!summary?.textContent?.trim() && !summary?.querySelector('time[data-afm-format]'))
          n.remove();
      });
    const appearedNow = new Set<string>();
    this.element
      .querySelectorAll<HTMLElement>(
        'details,section,form,footer,[data-afm-type],[data-math],[data-preview]',
      )
      .forEach((n, index) => {
        const key = `${n.tagName}:${n.dataset.afmType ?? ''}:${index}`;
        if (state.streaming && !this.appeared.has(key)) n.classList.add('afm-enter');
        appearedNow.add(key);
      });
    this.appeared = appearedNow;
    if (state.streaming)
      this.element.querySelectorAll('a[href]').forEach((n) => {
        n.removeAttribute('href');
        n.setAttribute('aria-disabled', 'true');
      });
    if (mode === 'plain') {
      this.renderPlain();
      return;
    }
    const projectedKinds = projectLatestSummaries(this.element);
    decorateActivity(
      this.element,
      !state.interrupted && this.options.live !== false,
      projectedKinds,
    );
    this.bindSpoilers();
    this.renderMath(state);
    this.renderDiagrams(state, revision);
    this.renderPreviews();
    this.bindDisclosures(focusedDisclosure);
    this.cleanup.push(bindTimers(this.element, this.options, state));
    this.element.querySelectorAll<HTMLProgressElement>('progress').forEach((n) => {
      const max = n.hasAttribute('max') ? Number(n.getAttribute('max')) : 1;
      const value = n.hasAttribute('value') ? Number(n.getAttribute('value')) : undefined;
      if (
        !Number.isFinite(max) ||
        max <= 0 ||
        (value !== undefined && (!Number.isFinite(value) || value < 0 || value > max))
      )
        n.removeAttribute('value');
    });
    this.actions.bind(this.element, this.options.actions, Boolean(state.streaming));
    if (focus?.key)
      this.element
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          '[data-afm-input]',
        )
        .forEach((n) => {
          if (n.dataset.afmInput !== focus.key || n.disabled) return;
          n.focus({ preventScroll: true });
          if (!(n instanceof HTMLSelectElement) && focus.start !== null && focus.end !== null) {
            try {
              n.setSelectionRange(focus.start, focus.end);
            } catch {
              /* Non-text inputs do not support ranges. */
            }
          }
        });
    this.element.querySelectorAll('*').forEach((n) => {
      if (!(n instanceof HTMLElement)) return;
      const type = n.dataset.afmType ?? (n.localName.includes('-') ? n.localName : '');
      const widget =
        this.options.widgets && Object.hasOwn(this.options.widgets, type)
          ? this.options.widgets[type]
          : undefined;
      if (widget && !state.streaming) {
        const dispose = widget(n, state);
        if (dispose) this.cleanup.push(dispose);
      } else if (
        !widget &&
        n.dataset.afmFallback === 'omit' &&
        (type.includes(':') || n.localName.includes('-'))
      )
        n.remove();
    });
  }
  private renderPlain() {
    this.element.querySelectorAll<HTMLElement>('.diff-bundle').forEach((n) => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = decode(n.dataset.patch!);
      pre.append(code);
      n.replaceWith(pre);
    });
    this.element.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((n) => {
      if (!n.closest('form')) n.replaceWith(document.createTextNode(n.checked ? '[x] ' : '[ ] '));
    });
    this.element.querySelectorAll('audio,video').forEach((n) => n.remove());
    this.element
      .querySelectorAll(
        '[data-afm-fallback="omit"],form,button,input,textarea,select,progress,time[data-afm-format],[data-preview],.preview-pending',
      )
      .forEach((n) => n.remove());
    this.element
      .querySelectorAll('spoiler')
      .forEach((n) => n.replaceWith(document.createTextNode('[spoiler omitted]')));
    this.element.querySelectorAll('[data-math]').forEach((n) => {
      const code = document.createElement('code');
      code.textContent = decode(n.getAttribute('data-math')!);
      n.replaceWith(code);
    });
    this.element.querySelectorAll('details,summary,section,span[data-afm-type]').forEach((n) => {
      const p = document.createElement(n.tagName === 'SUMMARY' ? 'p' : 'div');
      p.append(...Array.from(n.childNodes));
      n.replaceWith(p);
    });
    this.element.querySelectorAll('[data-afm-type],[data-afm-state]').forEach((n) => {
      n.removeAttribute('data-afm-type');
      n.removeAttribute('data-afm-state');
    });
  }

  private bindSpoilers() {
    this.element.querySelectorAll<HTMLElement>('spoiler').forEach((n) => {
      n.tabIndex = 0;
      n.setAttribute('role', 'button');
      n.setAttribute('aria-label', 'Reveal spoiler');
      n.setAttribute('aria-expanded', 'false');
      const reveal = () => {
        n.classList.toggle('revealed');
        n.setAttribute('aria-expanded', String(n.classList.contains('revealed')));
      };
      this.listen(n, 'click', reveal);
      this.listen(n, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          reveal();
        }
      });
    });
  }

  private renderMath(state: RenderState) {
    this.element.querySelectorAll<HTMLElement>('[data-math]').forEach((n) => {
      const tex = decode(n.dataset.math!);
      if (!tex.trim()) {
        n.remove();
        return;
      }
      if (this.math.get(n)?.source === tex && n.innerHTML === this.math.get(n)?.html) return;
      try {
        katex.render(tex, n, {
          displayMode: n.dataset.display === 'true',
          throwOnError: true,
          trust: false,
          strict: 'warn',
          maxExpand: 200,
        });
        this.math.set(n, { source: tex, html: n.innerHTML });
      } catch {
        if (state.streaming) {
          const cached = this.math.get(n);
          if (cached && tex.startsWith(cached.source)) n.innerHTML = cached.html;
          else n.remove();
        } else {
          n.textContent = 'Math could not be typeset.';
          n.setAttribute('role', 'note');
        }
      }
    });
  }

  private renderDiagrams(state: RenderState, revision: number) {
    this.element.querySelectorAll<HTMLElement>('[data-diagram]').forEach((n) => {
      const source = decode(n.dataset.diagram!);
      const cached = this.diagrams.get(n);
      if (cached && source.startsWith(cached.source) && n.innerHTML !== cached.svg)
        n.innerHTML = cached.svg;
      if (cached?.source === source) return;
      const epoch = this.epoch;
      const timer = setTimeout(
        () => {
          this.options.diagram!(source)
            .then((svg) => {
              if (this.disposed || epoch !== this.epoch || revision !== this.revision) return;
              const safe = DOMPurify.sanitize(svg, {
                USE_PROFILES: { svg: true },
                FORBID_TAGS: ['foreignObject', 'style', 'a'],
                FORBID_ATTR: ['href', 'xlink:href', 'style'],
              });
              this.diagrams.set(n, { source, svg: safe });
              n.innerHTML = safe;
            })
            .catch(() => {
              if (
                this.disposed ||
                epoch !== this.epoch ||
                revision !== this.revision ||
                state.streaming
              )
                return;
              n.textContent = 'Diagram could not be rendered.';
            });
        },
        state.streaming ? 100 : 0,
      );
      this.cleanup.push(() => clearTimeout(timer));
    });
  }

  private renderPreviews() {
    this.element.querySelectorAll<HTMLElement>('[data-preview]').forEach((n) => {
      if (n.firstElementChild?.localName === 'iframe') return;
      const frame = document.createElement('iframe');
      frame.title = n.dataset.previewTitle || 'HTML preview';
      frame.setAttribute('sandbox', '');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      // Remove scripts, navigation-capable elements and authored CSP/base declarations first.
      const payload = DOMPurify.sanitize(decode(n.dataset.preview!), {
        WHOLE_DOCUMENT: true,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'form'],
        FORBID_ATTR: ['action', 'formaction', 'href'],
        ADD_TAGS: ['style'],
      });
      frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'">${payload}`;
      n.replaceChildren(frame);
    });
  }

  private bindDisclosures(focusedDisclosure?: string) {
    this.element.querySelectorAll<HTMLElement>('ul,ol').forEach((list) => {
      if (Array.from(list.children).some((li) => li.firstElementChild?.localName === 'details'))
        list.classList.add('disclosure-list');
    });
    // The disclosure is the list row; its marker replaces the ordinary bullet.
    this.element.querySelectorAll<HTMLLIElement>('li').forEach((n) => {
      if (n.firstElementChild?.localName === 'details' && !n.firstChild?.textContent?.trim())
        n.classList.add('disclosure-item');
      else if (n.firstChild === n.firstElementChild && n.firstElementChild?.localName === 'details')
        n.classList.add('disclosure-item');
      const row = n.querySelector(
        ':scope > span[data-afm-type="activity"]:only-child, :scope > p:only-child > span[data-afm-type="activity"]:only-child',
      );
      if (row && n.textContent?.trim() === row.textContent?.trim())
        n.classList.add('activity-item');
    });
    this.element.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      this.listen(a, 'click', (event) => {
        const target = Array.from(this.element.querySelectorAll('[id]')).find(
          (n) => n.id === a.hash.slice(1),
        );
        if (target) {
          event.preventDefault();
          target.scrollIntoView?.({ block: 'nearest' });
          target.setAttribute('tabindex', '-1');
          (target as HTMLElement).focus({ preventScroll: true });
        }
      });
    });
    const presentDisclosures = new Set<string>();
    this.element.querySelectorAll<HTMLDetailsElement>('details').forEach((n, i) => {
      const key = n.id || `position:${i}`;
      presentDisclosures.add(key);
      n.dataset.afmDisclosure = key;
      if (this.expansion.has(key)) n.open = this.expansion.get(key)!;
      this.listen(n, 'toggle', () => this.expansion.set(key, n.open));
      if (key === focusedDisclosure)
        n.querySelector<HTMLElement>(':scope > summary')?.focus({ preventScroll: true });
    });
    for (const key of this.expansion.keys())
      if (!presentDisclosures.has(key)) this.expansion.delete(key);
    for (const node of this.math.keys()) if (!this.element.contains(node)) this.math.delete(node);
    for (const node of this.diagrams.keys())
      if (!this.element.contains(node)) this.diagrams.delete(node);
  }

  private listen<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) {
    element.addEventListener(type, listener);
    this.cleanup.push(() => element.removeEventListener(type, listener));
  }
  dispose() {
    if (this.disposed) return;
    this.element
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        'form input,form button,form textarea,form select,button[data-afm-action]',
      )
      .forEach((control) => {
        control.disabled = true;
      });
    this.actions.reset();
    this.epoch++;
    this.disposed = true;
    this.release();
  }

  private release() {
    const cleanup = this.cleanup;
    this.cleanup = [];
    const errors: unknown[] = [];
    for (const dispose of cleanup) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Renderer cleanup failed');
  }
}
