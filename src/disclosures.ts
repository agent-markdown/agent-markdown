import type MarkdownIt from 'markdown-it';

/** Selected AFM syntax. Body indentation follows the underlying Markdown list parser. */
export function disclosures(md: MarkdownIt) {
  md.block.ruler.before(
    'blockquote',
    'afm-disclosure-alias',
    (state, start, end, silent) => {
      if (state.sCount[start] - state.blkIndent >= 4) return false;
      const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
      const header = /^> (\S.*)$/.exec(line);
      if (!header || start + 1 >= end) return false;
      const indent = state.sCount[start] + 4;
      // An immediately following indented line is deliberate; ordinary quote continuations stay quotes.
      if (state.isEmpty(start + 1) || state.sCount[start + 1] < indent) return false;
      if (silent) return true;
      let next = start + 1;
      while (next < end && (state.isEmpty(next) || state.sCount[next] >= indent)) next++;
      const depth = state.env.afmDepth ?? 0;
      if (depth >= 64) throw new Error('AFM disclosure nesting exceeds renderer limit');
      const open = state.push('details_open', 'details', 1);
      open.block = true;
      open.map = [start, next];
      state.push('summary_open', 'summary', 1);
      const label = state.push('inline', '', 0);
      label.content = header[1];
      label.children = [];
      state.push('summary_close', 'summary', -1);
      const children: typeof state.tokens = [];
      state.env.afmDepth = depth + 1;
      try {
        md.block.parse(state.getLines(start + 1, next, indent, false), md, state.env, children);
      } finally {
        state.env.afmDepth = depth;
      }
      for (const child of children)
        if (child.map) child.map = [child.map[0] + start + 1, child.map[1] + start + 1];
      state.tokens.push(...children);
      state.push('details_close', 'details', -1).block = true;
      state.line = next;
      return true;
    },
    { alt: ['paragraph', 'reference', 'list'] },
  );

  md.core.ruler.before('inline', 'afm-disclosures', (state) => {
    const tokens = state.tokens;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (
        tokens[i].type !== 'list_item_open' ||
        tokens[i + 1]?.type !== 'paragraph_open' ||
        tokens[i + 2]?.type !== 'inline'
      )
        continue;
      const header = /^\[([-+])\][ \t]+([^\n]+)(?:\n([\s\S]*))?$/.exec(tokens[i + 2].content);
      if (!header || !header[2].trim()) continue; // In particular, never consume [ ], [x], or [X].
      let depth = 1,
        end = i + 1;
      for (; end < tokens.length; end++) {
        if (tokens[end].type === 'list_item_open') depth++;
        if (tokens[end].type === 'list_item_close' && --depth === 0) break;
      }
      const token = (type: string, tag: string, nesting: -1 | 0 | 1) =>
        new state.Token(type, tag, nesting);
      const open = token('details_open', 'details', 1);
      open.block = true;
      if (header[1] === '+') open.attrSet('open', '');
      const label = token('inline', '', 0);
      label.content = header[2];
      label.children = [];
      const replacement = [
        open,
        token('summary_open', 'summary', 1),
        label,
        token('summary_close', 'summary', -1),
      ];
      if (header[3]) {
        const body = token('inline', '', 0);
        body.content = header[3];
        body.children = [];
        replacement.push(token('paragraph_open', 'p', 1), body, token('paragraph_close', 'p', -1));
      }
      const close = token('details_close', 'details', -1);
      close.block = true;
      tokens.splice(end, 0, close);
      tokens.splice(i + 1, 3, ...replacement);
    }
  });
}
