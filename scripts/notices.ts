import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Include installed dependency notices with the bundled website (not the externalized package). */
export async function dependencyNotices() {
  const directories: string[] = [];
  for (const entry of await readdir('node_modules', { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      for (const name of await readdir(join('node_modules', entry.name)))
        directories.push(join('node_modules', entry.name, name));
    } else directories.push(join('node_modules', entry.name));
  }
  const notices = [
    '# Third-party notices\n\nThe website bundles open-source dependencies. Installed build dependencies are also listed for completeness. Their licenses remain unchanged.',
  ];
  for (const directory of directories.sort()) {
    const file = Bun.file(join(directory, 'package.json'));
    if (!(await file.exists())) continue;
    const info = await file.json();
    notices.push(
      `\n## ${info.name} ${info.version}\n\nLicense: ${typeof info.license === 'string' ? info.license : 'See package notices'}`,
    );
    for (const name of (await readdir(directory)).filter((name) =>
      /^(?:licen[cs]e|copying|ofl)(?:\.|$)/i.test(name),
    )) {
      const license = Bun.file(join(directory, name));
      if (license.size) notices.push(`\n### ${name}\n\n${await license.text()}`);
    }
  }
  return notices.join('\n') + '\n';
}
