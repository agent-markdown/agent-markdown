import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type { Delimiter } from 'markdown-it/lib/rules_inline/state_inline.mjs';

/** Pair parsed delimiters, so code spans, escapes and destinations stay literal. */
export function delimiters(md: MarkdownIt) {
  const markers = new Map<number, { tag: string; markup: string }>([
    [1261, { tag: 's', markup: '~' }],
    [1262, { tag: 's', markup: '~~' }],
    [612, { tag: 'mark', markup: '==' }],
    [1242, { tag: 'spoiler', markup: '||' }],
  ]);
  md.inline.ruler.disable('strikethrough');
  md.inline.ruler.before('emphasis', 'afm-delimiters', (state, silent) => {
    const char = state.src[state.pos];
    if (silent || !['~', '=', '|'].includes(char)) return false;
    const scanned = state.scanDelims(state.pos, true);
    // GFM only recognizes one- or two-tilde runs as strikethrough.
    if (char === '~' && scanned.length > 2) {
      state.push('text', '', 0).content = char.repeat(scanned.length);
      state.pos += scanned.length;
      return true;
    }
    if (char !== '~' && scanned.length < 2) return false;
    const width = char === '~' && scanned.length === 1 ? 1 : 2;
    if (scanned.length % width) state.push('text', '', 0).content = char;
    for (let n = scanned.length % width; n < scanned.length; n += width) {
      state.push('text', '', 0).content = char.repeat(width);
      state.delimiters.push({
        marker: char.charCodeAt(0) * 10 + width,
        length: 0,
        token: state.tokens.length - 1,
        end: -1,
        open: scanned.can_open,
        close: scanned.can_close,
      });
    }
    state.pos += scanned.length;
    return true;
  });
  function process(state: StateInline, list: Delimiter[]) {
    const lone: number[] = [];
    for (const start of list) {
      const spec = markers.get(start.marker);
      if (!spec || start.end < 0) continue;
      const end = list[start.end];
      for (const [position, nesting] of [
        [start.token, 1],
        [end.token, -1],
      ] as const) {
        const token = state.tokens[position];
        token.type = `${spec.tag}_${nesting === 1 ? 'open' : 'close'}`;
        token.tag = spec.tag;
        token.nesting = nesting;
        token.markup = spec.markup;
        token.content = '';
      }
      if (
        spec.markup.length === 2 &&
        state.tokens[end.token - 1]?.type === 'text' &&
        state.tokens[end.token - 1].content === spec.markup[0]
      )
        lone.push(end.token - 1);
    }
    // Put an odd leftover marker after adjacent closing tags, matching GFM strikes.
    for (const position of lone.reverse()) {
      let end = position;
      while (state.tokens[end + 1]?.nesting === -1) end++;
      if (end > position)
        [state.tokens[position], state.tokens[end]] = [state.tokens[end], state.tokens[position]];
    }
  }
  md.inline.ruler2.before('fragments_join', 'afm-delimiters', (state) => {
    process(state, state.delimiters);
    for (const meta of state.tokens_meta) if (meta?.delimiters) process(state, meta.delimiters);
    return true;
  });
  // Reuse CommonMark underscore emphasis rules, including Unicode flanking and code isolation.
  md.core.ruler.after('inline', 'afm-underline', (state) => {
    for (const block of state.tokens)
      for (const token of block.children ?? []) {
        if (
          token.markup === '__' &&
          (token.type === 'strong_open' || token.type === 'strong_close')
        ) {
          token.tag = 'u';
          token.type = token.type.replace('strong_', 'u_');
        }
      }
  });
}
