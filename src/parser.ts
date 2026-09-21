import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import footnote from 'markdown-it-footnote';
import { streamingInline } from './streaming';
import { delimiters } from './delimiters';
import { disclosures } from './disclosures';
import { renderDiff } from './diff';

import type { RendererOptions, RenderState } from './types';

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const md = new MarkdownIt({ html: true, linkify: true, breaks: false });
const validateLink = md.validateLink;
md.validateLink = (url) => /^file:\/\//i.test(url.trim()) || validateLink(url);
// The plugin types target markdown-it CJS; this app uses its identical ESM runtime API.
md.use(footnote as unknown as (parser: MarkdownIt) => void);
// Keep named, block-defined footnotes; inline ^[notes] are not part of this draft.
md.inline.ruler.disable('footnote_inline');
md.use(disclosures);
md.core.ruler.before('inline', 'afm-stream-inline', (state) => {
  if (state.env.streaming)
    for (const token of state.tokens)
      if (token.type === 'inline') token.content = streamingInline(token.content);
});
md.renderer.rules.footnote_caption = (tokens, i) => `[${tokens[i].meta.id + 1}]`;
const encode = (s: string) => escape(encodeURIComponent(s.toWellFormed()));
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// markdown-it's stock text tokenizer does not stop at spoiler delimiters.
const originalText = md.inline.ruler.getRules('')[0];
md.inline.ruler.at('text', (state, silent) => {
  if (state.src.startsWith('||', state.pos)) return false;
  const next = state.src.indexOf('||', state.pos + 1);
  const end = state.posMax;
  if (next >= 0) state.posMax = Math.min(end, next);
  const result = originalText(state, silent);
  state.posMax = end;
  return result;
});

md.use(delimiters);
md.inline.ruler.before('escape', 'afm-math', (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== '$') return false;
  const marker = state.src.startsWith('$$', start) ? '$$' : '$';
  if (/\s/.test(state.src[start + marker.length] ?? '')) return false;
  let end = state.src.indexOf(marker, start + marker.length);
  while (end > -1 && state.src[end - 1] === '\\')
    end = state.src.indexOf(marker, end + marker.length);
  // An unfinished math candidate is buffered, including its delimiters. No guessed source.
  if (end < 0 && state.env.streaming) {
    if (!silent && state.src.slice(start + marker.length).trim()) {
      const token = state.push('afm_math', '', 0);
      token.content = state.src.slice(start + marker.length);
      token.meta = { display: marker.length === 2 };
    }
    state.pos = state.posMax;
    return true;
  }
  if (
    end < 0 ||
    /\s/.test(state.src[start + marker.length] ?? ' ') ||
    /\s/.test(state.src[end - 1]) ||
    /\d/.test(state.src[end + marker.length] ?? '')
  )
    return false;
  const content = state.src.slice(start + marker.length, end);
  if (marker === '$' && content.includes('\n')) return false;
  if (!silent) {
    const token = state.push('afm_math', '', 0);
    token.content = content;
    token.meta = { display: marker.length === 2 };
  }
  state.pos = end + marker.length;
  return true;
});
// Multiline display math is a block context, independent of paragraph boundaries.
md.block.ruler.before(
  'fence',
  'afm-math-block',
  (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(start, state.eMarks[startLine]).trim() !== '$$') return false;
    let next = startLine + 1;
    while (
      next < endLine &&
      state.src.slice(state.bMarks[next] + state.tShift[next], state.eMarks[next]).trim() !== '$$'
    )
      next++;
    if (silent) return true;
    const token = state.push('afm_math', '', 0);
    token.content = state.getLines(startLine + 1, next, state.blkIndent, false);
    token.meta = { display: true };
    // Unclosed display math is attempted provisionally; failed revisions retain the last useful view.
    token.map = [startLine, Math.min(next + 1, endLine)];
    state.line = Math.min(next + 1, endLine);
    return true;
  },
  { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
);
md.renderer.rules.afm_math = (tokens, i) =>
  `<span data-math="${encode(tokens[i].content)}" data-display="${Boolean(tokens[i].meta?.display)}"></span>`;
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, i, options, env, self) => {
  const language = tokens[i].info.trim().split(/\s/)[0];
  if (language === 'mermaid' && env.diagrams)
    return `<div data-diagram="${encode(tokens[i].content)}"></div>`;
  if (language === 'math')
    return `<div data-math="${encode(tokens[i].content)}" data-display="true"></div>`;
  if (language === 'diff') return renderDiff(tokens[i].content);
  return defaultFence(tokens, i, options, env, self);
};
md.renderer.rules.html_block = (tokens, i, _options, env) => {
  let raw = tokens[i].content;
  // iframe is a literal context in markdown-it. Never interpret its body as Markdown.
  if (/^\s*<iframe(?=[\s>])/i.test(raw)) {
    const match = raw.match(
      /^\s*(<iframe(?=[\s>])(?:[^"'<>]|"[^"]*"|'[^']*')*>)([\s\S]*?)<\/iframe\s*>/i,
    );
    if (!match) return '';
    // An inert template applies native attribute quoting and entity decoding.
    const metadata = document.createElement('template');
    metadata.innerHTML = match[1] + '</iframe>';
    const title = metadata.content.querySelector('iframe')?.getAttribute('title') || 'HTML preview';
    return (
      `<div data-preview="${encode(match[2])}" data-preview-title="${escape(title)}"></div>` +
      escape(raw.slice(match[0].length))
    );
  }
  if (env.streaming && /<summary(?=[\s>])[^>]*>[^<]*$/i.test(raw)) raw += '</summary>';
  raw = raw.replace(
    /(<summary(?=[\s>])(?:[^"'<>]|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/summary>)/gi,
    (_, open, body, close) =>
      open + md.renderInline(env.streaming ? streamingInline(body) : body, env) + close,
  );
  return raw;
};
// GFM-style task markers, implemented on parsed inline tokens inside list items.
md.core.ruler.after('inline', 'afm-tasks', (state) => {
  state.tokens.forEach((token, i) => {
    if (
      token.type !== 'inline' ||
      state.tokens[i - 1]?.type !== 'paragraph_open' ||
      state.tokens[i - 2]?.type !== 'list_item_open'
    )
      return;
    const first = token.children?.[0];
    const match = first?.type === 'text' ? first.content.match(/^\[([ xX])\]\s+/) : null;
    if (!match || !first) return;
    first.content = first.content.slice(match[0].length);
    const input = new state.Token('html_inline', '', 0);
    input.content = `<input type="checkbox" disabled ${match[1] !== ' ' ? 'checked' : ''} aria-label="Task status"> `;
    token.children!.unshift(input);
  });
});

export function renderHTML(
  source: string,
  mode: RendererOptions['mode'] = 'rich',
  env: RenderState & { docId?: string; maxNestingDepth?: number; diagrams?: boolean } = {},
): string {
  if (!DOMPurify.isSupported)
    throw new Error('AFM requires a supported browser DOM for sanitization');
  const html = md.render(source, env);
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: [
      'spoiler',
      'time',
      'progress',
      'form',
      'input',
      'button',
      'fieldset',
      'legend',
      'label',
      'textarea',
      'select',
      'option',
      'figure',
      'figcaption',
      'audio',
      'video',
      'source',
      'track',
    ],
    ADD_ATTR: ['datetime', 'value', 'max', 'name', 'type', 'checked', 'disabled', 'for'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'action', 'formaction', 'target', 'autoplay'],
    ALLOW_DATA_ATTR: true,
    // DOMPurify's default URL policy, with file URLs included.
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|file|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^[a-z][a-z0-9]*-[a-z0-9-]+$/,
      attributeNameCheck: /^data-/,
    },
  });
  const pending: Array<[Node, number]> = [[fragment, 0]];
  while (pending.length) {
    const [node, depth] = pending.pop()!;
    if (depth > (env.maxNestingDepth ?? 128))
      throw new RangeError('AFM content exceeds nesting limit');
    for (const child of Array.from(node.childNodes)) pending.push([child, depth + 1]);
  }
  fragment.querySelectorAll('audio,video').forEach((n) => {
    n.setAttribute('controls', '');
    n.setAttribute('preload', 'none');
    if (n.localName === 'video') n.setAttribute('playsinline', '');
  });
  // Author IDs are optional and document-local. Preserve native label/ARIA/link semantics.
  if (env.docId) {
    const ids = new Map<string, string>();
    fragment.querySelectorAll('[id]').forEach((n) => {
      const original = n.id;
      if (ids.has(original)) {
        n.removeAttribute('id');
        return;
      }
      const scoped = `${env.docId}-${original}`;
      ids.set(original, scoped);
      n.id = scoped;
    });
    fragment.querySelectorAll('*').forEach((n) => {
      for (const attr of [
        'for',
        'aria-labelledby',
        'aria-describedby',
        'aria-controls',
        'aria-details',
        'headers',
        'list',
      ]) {
        const value = n.getAttribute(attr);
        if (value)
          n.setAttribute(
            attr,
            value
              .split(/\s+/)
              .map((id) => ids.get(id) ?? id)
              .join(' '),
          );
      }
      const href = n.getAttribute('href');
      if (href?.startsWith('#') && ids.has(href.slice(1)))
        n.setAttribute('href', '#' + ids.get(href.slice(1))!);
    });
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}
