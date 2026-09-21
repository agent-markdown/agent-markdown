const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
/** Unified-patch presentation. Line numbers come from hunk headers, never inferred from file labels. */
export function renderDiff(source: string): string {
  let old = 0,
    next = 0,
    oldLeft = 0,
    nextLeft = 0;
  let file = { name: 'Changes', rows: [] as string[], added: 0, removed: 0 };
  const files = [file];
  for (const line of source.replace(/\n$/, '').split('\n')) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      old = Number(hunk[1]);
      next = Number(hunk[3]);
      oldLeft = Number(hunk[2] ?? 1);
      nextLeft = Number(hunk[4] ?? 1);
      file.rows.push(`<tr class="diff-hunk"><td colspan="3">${escape(line)}</td></tr>`);
      continue;
    }
    if (!oldLeft && !nextLeft && line.startsWith('--- ')) {
      if (file.rows.length) {
        file = { name: 'Changes', rows: [], added: 0, removed: 0 };
        files.push(file);
      }
      file.name = line.slice(4).split('\t')[0].replace(/^a\//, '');
      continue;
    }
    if (!oldLeft && !nextLeft && line.startsWith('+++ ')) {
      if (!line.includes('/dev/null')) file.name = line.slice(4).split('\t')[0].replace(/^b\//, '');
      continue;
    }
    if (
      /^(diff |index |new file mode|deleted file mode|rename |similarity index)/.test(line) &&
      !oldLeft &&
      !nextLeft
    )
      continue;
    const kind = line.startsWith('+')
      ? 'added'
      : line.startsWith('-')
        ? 'removed'
        : line.startsWith(' ')
          ? 'context'
          : 'meta';
    const before = oldLeft > 0 && (kind === 'removed' || kind === 'context') ? String(old++) : '';
    const after = nextLeft > 0 && (kind === 'added' || kind === 'context') ? String(next++) : '';
    if (before) oldLeft--;
    if (after) nextLeft--;
    if (kind === 'added') file.added++;
    if (kind === 'removed') file.removed++;
    file.rows.push(
      `<tr class="diff-line ${kind}"><td class="line-number">${before}</td><td class="line-number">${after}</td><td class="line-code">${escape(line)}</td></tr>`,
    );
  }
  return `<div class="diff-bundle" data-patch="${escape(encodeURIComponent(source))}">${files.map((file) => `<section class="afm-diff"><header class="diff-heading"><span>${escape(file.name)}</span><span class="diff-count"><span class="added">+${file.added}</span> <span class="removed">−${file.removed}</span></span></header><div class="diff-scroll" tabindex="0" role="region" aria-label="${escape(file.name)} diff"><table><tbody>${file.rows.join('')}</tbody></table></div></section>`).join('')}<pre class="diff-source" hidden><code>${escape(source)}</code></pre></div>`;
}
