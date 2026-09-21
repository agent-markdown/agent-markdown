/** Buffer unfinished HTML syntax, not ordinary container contents. Source stays immutable. */
export function displayPrefix(
  source: string,
  literalBlocks: ReadonlyArray<readonly [number, number]> = [],
): string {
  const voids = new Set(
    'area base br col embed hr img input link meta param source track wbr'.split(' '),
  );
  const before = (start: number) => {
    const line = source.lastIndexOf('\n', start - 1) + 1;
    const prefix = source.slice(line, start);
    return source.slice(0, /^\s*(?:[-+*]|\d+[.)])?\s*$/.test(prefix) ? line : start);
  };
  let literalIndex = 0;
  let fence: string | undefined;
  let lineStart = true;
  for (let i = 0; i < source.length;) {
    while (literalBlocks[literalIndex]?.[1] <= i) literalIndex++;
    const literal = literalBlocks[literalIndex];
    if (literal && literal[0] <= i) {
      i = literal[1];
      lineStart = source[i - 1] === '\n';
      continue;
    }
    if (lineStart) {
      const lineEnd = source.indexOf('\n', i);
      const line = source.slice(i, lineEnd < 0 ? undefined : lineEnd);
      const match = line.match(/^\s*(?:[-*+]\s+)?(`{3,}|~{3,})/);
      if (match) {
        if (!fence) fence = match[1];
        else if (
          match[1][0] === fence[0] &&
          match[1].length >= fence.length &&
          line.slice(match[0].length).trim() === ''
        )
          fence = undefined;
        i = lineEnd < 0 ? source.length : lineEnd + 1;
        lineStart = true;
        continue;
      }
      if (fence) {
        i = lineEnd < 0 ? source.length : lineEnd + 1;
        continue;
      }
    }
    lineStart = source[i] === '\n';
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '`') {
      const run = source.slice(i).match(/^`+/)![0];
      let end = source.indexOf(run, i + run.length);
      while (end >= 0 && (source[end - 1] === '`' || source[end + run.length] === '`'))
        end = source.indexOf(run, end + run.length);
      if (end >= 0) {
        i = end + run.length;
        continue;
      }
      return source; // An open code span owns the rest of this prefix.
    }
    if (source[i] === '$') {
      const marker = source.startsWith('$$', i) ? '$$' : '$';
      let end = source.indexOf(marker, i + marker.length);
      while (end >= 0 && source[end - 1] === '\\')
        end = source.indexOf(marker, end + marker.length);
      if (end < 0) return source;
      i = end + marker.length;
      continue;
    }
    if (source[i] === '&' && /^&(?:#x[0-9a-f]*|#\d*|[a-z][a-z0-9]*)?$/i.test(source.slice(i)))
      return before(i);
    if (source[i] !== '<') {
      i++;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      if (end < 0) return before(i);
      i = end + 3;
      continue;
    }
    const tail = source.slice(i);
    if (!/^<(?:\/?[A-Za-z]|$|\/$|!)/.test(tail)) {
      i++;
      continue;
    }
    // Locate a complete tag without treating '>' inside quoted attributes as a close.
    let quote = '';
    let end = i + 1;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
    }
    if (end === source.length) return before(i);
    const tag = source.slice(i, end + 1);
    // Autolinks are Markdown, not HTML containers.
    if (/^<[A-Za-z][A-Za-z0-9+.-]*:/.test(tag) || /^<[^ <>]+@[^ <>]+>$/.test(tag)) {
      i = end + 1;
      continue;
    }
    const match = tag.match(/^<(\/)?([A-Za-z][A-Za-z0-9:-]*)(?=[\s/>])/);
    if (!match) {
      i = end + 1;
      continue;
    }
    const name = match[2].toLowerCase();
    if (!match[1] && !voids.has(name)) {
      if (['iframe', 'script', 'style', 'textarea', 'title', 'audio', 'video'].includes(name)) {
        const close = new RegExp(`</${name}\\s*>`, 'ig');
        close.lastIndex = end + 1;
        const found = close.exec(source);
        if (!found) return before(i);
        i = found.index + found[0].length;
        continue;
      }
    }
    i = end + 1;
  }
  return source;
}

/** Keep literal payload boundaries, but allow ordinary text to advance character by character. */
export function markdownCheckpoint(source: string, diagramCheckpoints = false): string {
  let fence: { marker: string; language: string; start: number } | undefined;
  let offset = 0;
  for (const line of source.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const match = /^\s*(`{3,}|~{3,})([^\n]*)/.exec(line);
    if (fence) {
      if (
        match &&
        match[1][0] === fence.marker[0] &&
        match[1].length >= fence.marker.length &&
        !match[2].trim()
      )
        fence = undefined;
    } else if (match) {
      if (!line.endsWith('\n')) return source.slice(0, offset);
      fence = { marker: match[1], language: match[2].trim().split(/\s/)[0], start: offset };
    }
    offset += line.length;
  }
  if (fence) {
    if (fence.language === 'mermaid')
      return diagramCheckpoints
        ? source.slice(0, source.lastIndexOf('\n') + 1)
        : source.slice(0, fence.start);
    // Do not expose a partial closing fence as literal code.
    const start = source.lastIndexOf('\n') + 1;
    if (/^\s*[`~]{1,2}$/.test(source.slice(start))) return source.slice(0, start);
    return source;
  }
  const start = source.lastIndexOf('\n') + 1,
    tail = source.slice(start);
  if (/^\s*(?:#{1,6}|[-+*]|\d+[.)]|>|[-+*] \[[ xX+\-]?\]?\s*)$/.test(tail))
    return source.slice(0, start);
  return source;
}

/** Temporary inline completion for display only; final parsing always uses original source. */
export function streamingInline(source: string): string {
  const stack: string[] = [];
  let output = '';
  const finish = () => output + stack.slice().reverse().join('');
  for (let i = 0; i < source.length;) {
    const ch = source[i];
    if (ch === '\\') {
      if (i + 1 === source.length) return finish();
      output += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '<') {
      const tag = /^<(?:(?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(source.slice(i));
      if (tag) {
        output += tag[0];
        i += tag[0].length;
        continue;
      }
    }
    if (ch === '$') {
      // Math parser owns all incomplete TeX, including its internal punctuation.
      const marker = source.startsWith('$$', i) ? '$$' : '$';
      let end = source.indexOf(marker, i + marker.length);
      while (end >= 0 && source[end - 1] === '\\')
        end = source.indexOf(marker, end + marker.length);
      if (end < 0) {
        output += source.slice(i);
        return finish();
      }
      output += source.slice(i, end + marker.length);
      i = end + marker.length;
      continue;
    }
    if (ch === '`') {
      const marker = /^`+/.exec(source.slice(i))![0];
      let end = source.indexOf(marker, i + marker.length);
      while (end >= 0 && (source[end - 1] === '`' || source[end + marker.length] === '`'))
        end = source.indexOf(marker, end + marker.length);
      if (end < 0) {
        const body = source.slice(i + marker.length);
        if (body) output += marker + body + marker;
        return finish();
      }
      output += source.slice(i, end + marker.length);
      i = end + marker.length;
      continue;
    }
    if (ch === '[' || (ch === '!' && source[i + 1] === '[')) {
      const begin = i + (ch === '!' ? 1 : 0);
      let depth = 1,
        end = begin + 1;
      // Scan balanced labels without interpreting punctuation in destinations.
      for (; end < source.length; end++) {
        if (source[end] === '\\') {
          end++;
          continue;
        }
        if (source[end] === '[') depth++;
        if (source[end] === ']' && --depth === 0) break;
      }
      if (end === source.length) {
        output += source.slice(begin + 1);
        return finish();
      }
      const label = source.slice(begin + 1, end);
      if (source[end + 1] === '(') {
        let close = end + 2,
          level = 1;
        for (; close < source.length; close++) {
          if (source[close] === '\\') {
            close++;
            continue;
          }
          if (source[close] === '(') level++;
          if (source[close] === ')' && --level === 0) break;
        }
        if (close === source.length) {
          output += label;
          return finish();
        }
        output += source.slice(i, close + 1);
        i = close + 1;
        continue;
      }
      if (end === source.length - 1 && !label.startsWith('^')) {
        output += label;
        return finish();
      }
      output += source.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const marker = ['**', '__', '~~', '==', '||', '*', '_', '~'].find((m) =>
      source.startsWith(m, i),
    );
    if (marker) {
      if (stack.at(-1) === marker) {
        stack.pop();
        output += marker;
        i += marker.length;
        continue;
      }
      if (i + marker.length === source.length) {
        return finish();
      }
      if (stack.at(-1)?.startsWith(marker) && source.slice(i) === marker) return finish();
      if (
        !/\s/.test(source[i + marker.length]) &&
        !((marker === '_' || marker === '__') && /[\p{L}\p{N}]/u.test(source[i - 1] ?? ''))
      ) {
        stack.push(marker);
        output += marker;
        i += marker.length;
        continue;
      }
    }
    if (i === source.length - 1 && (ch === '|' || ch === '=')) return finish();
    output += ch;
    i++;
  }
  return finish();
}
