import { mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Keep previous generated artifacts; never discard an existing working tree. */
export async function prepareOutput(name: 'site' | 'package') {
  const path = resolve('dist', name);
  const marker = Bun.file(`${path}/.afm-build`);
  if (await marker.exists()) {
    await mkdir('.build', { recursive: true });
    await rename(path, resolve('.build', `${name}-${Date.now()}-${crypto.randomUUID()}`));
  } else {
    const { existsSync } = await import('node:fs');
    if (existsSync(path)) throw new Error(`Refusing to replace unrecognized output: ${path}`);
  }
  await mkdir(path, { recursive: true });
  await Bun.write(`${path}/.afm-build`, 'Generated AFM build output.\n');
  return path;
}

export async function run(command: string[], cwd = process.cwd()) {
  const result = Bun.spawn(command, { cwd, stdout: 'inherit', stderr: 'inherit' });
  if (await result.exited) throw new Error(`Failed: ${command.join(' ')}`);
}
