import MarkdownIt from 'markdown-it';

/** Assemble the page from authored rules; do not maintain a second copy in the UI. */
const parser = new MarkdownIt();
export interface SpecPageSection {
  id: string;
  title: string;
  markdown: string;
  examples: string[];
  source: string;
}
export function specPage(spec: string, components: string) {
  function sections(source: string) {
    const lines = source.split('\n');
    const tokens = parser.parse(source, {});
    const headings = tokens.flatMap((token, index) =>
      token.type === 'heading_open' && token.tag === 'h2' && token.map
        ? [{ title: tokens[index + 1].content, start: token.map[0], end: token.map[1] }]
        : [],
    );
    return new Map(
      headings.map((h, i) => [
        h.title,
        lines
          .slice(h.end, headings[i + 1]?.start ?? lines.length)
          .join('\n')
          .trim(),
      ]),
    );
  }
  const sources = { spec: sections(spec), components: sections(components) };
  const used = { spec: new Set<string>(), components: new Set<string>() };
  const page: SpecPageSection[] = [];
  function add(
    id: string,
    title: string,
    doc: keyof typeof sources,
    heading: string,
    examples: string[] = [],
    omitExamples = false,
  ) {
    let markdown = sources[doc].get(heading);
    if (markdown === undefined) throw new Error(`Missing spec section: ${heading}`);
    used[doc].add(heading);
    // These examples appear in the adjacent interactive comparison instead.
    if (omitExamples) {
      const lines = markdown.split('\n');
      const fences = parser.parse(markdown, {}).filter((t) => t.type === 'fence' && t.map);
      for (const token of fences.reverse())
        lines.splice(token.map![0], token.map![1] - token.map![0]);
      markdown = lines.join('\n').trim();
    }
    page.push({
      id,
      title,
      markdown,
      examples,
      source: doc === 'spec' ? 'SPEC.md' : 'docs/semantics.md',
    });
  }
  add('overview', 'Example', 'spec', 'Example', ['overview'], true);
  add('syntax', 'Syntax', 'spec', 'Syntax');
  add('reading', 'Reading this spec', 'spec', '1. Reading this spec');
  add('baseline', 'Baseline', 'spec', '2. Baseline');
  add(
    'disclosure-rules',
    'Disclosures',
    'components',
    'Disclosures and mixed content',
    ['disclosures'],
    true,
  );
  add('activity-rules', 'Activity', 'components', 'Activity', ['activity', 'latest-activity']);
  add('time-rules', 'Timers', 'components', 'Time', ['timer']);
  add('interaction-rules', 'Cards and forms', 'components', 'Cards and forms', [
    'cards',
    'forms',
    'choices',
  ]);
  add(
    'content-rules',
    'Previews, files, and content',
    'components',
    'Content and optional renderers',
    ['preview', 'diff', 'citations', 'math', 'diagrams', 'media', 'source'],
  );
  add(
    'file-links-rules',
    'File links',
    'components',
    'File links and line locations',
    ['file-links'],
    true,
  );
  add('formatting-rules', 'Inline formatting', 'components', 'Inline formatting', ['formatting']);
  add('parsing', 'Parsing', 'spec', '4. Parsing');
  add('streaming', 'Streaming', 'spec', '5. Streaming');
  add('attributes', 'Attributes and identity', 'components', 'Attributes and identity');
  add('extensions', 'Extensions and actions', 'spec', '6. Extensions and actions');
  add('support', 'Partial support', 'spec', '3. Partial support');
  add('errors', 'Errors and limits', 'spec', '7. Errors and limits');
  add('draft-status', 'Draft status', 'spec', '8. Draft status');
  for (const name of ['spec', 'components'] as const) {
    const missing = [...sources[name].keys()].filter((h) => !used[name].has(h));
    if (missing.length) throw new Error(`Spec sections missing from page: ${missing.join(', ')}`);
  }
  return page;
}
