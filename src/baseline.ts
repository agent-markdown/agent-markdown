import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
const baseline = new MarkdownIt({ html: true, linkify: true });
// Model a common host policy: parse standard Markdown, then strip HTML wrappers.
// This deliberately knows nothing about AFM markers, math, or vendor attributes.
export function renderBaseline(source: string): string {
  return DOMPurify.sanitize(baseline.render(source), {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'start'],
    ALLOW_DATA_ATTR: false,
    FORBID_CONTENTS: ['script', 'style', 'iframe', 'form', 'button', 'input', 'textarea', 'select'],
  });
}
