import { resolve, sep } from 'node:path';
import { siteHeaders } from './site-config';

export function serveSite(options: { root?: string; base?: string; port?: number } = {}) {
  const root = resolve(options.root ?? 'site');
  const base = '/' + (options.base ?? '').split('/').filter(Boolean).join('/');
  const prefix = base === '/' ? '/' : base + '/';
  return Bun.serve({
    hostname: '127.0.0.1',
    port: options.port ?? 4317,
    async fetch(request) {
      if (!['GET', 'HEAD'].includes(request.method))
        return new Response('Method not allowed', { status: 405 });
      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response('Invalid path', { status: 400 });
      }
      if (base !== '/' && pathname === base)
        return new Response(null, { status: 308, headers: { Location: prefix } });
      if (!pathname.startsWith(prefix)) return new Response('Not found', { status: 404 });
      const relative = pathname.slice(prefix.length) || 'index.html';
      if (relative.includes('\0') || relative.split('/').some((part) => part.startsWith('.')))
        return new Response('Not found', { status: 404 });
      const path = resolve(root, relative);
      if (!path.startsWith(root + sep)) return new Response('Not found', { status: 404 });
      const file = Bun.file(path);
      try {
        if (!(await file.exists())) return new Response('Not found', { status: 404 });
        return new Response(request.method === 'HEAD' ? null : file, {
          headers: { ...siteHeaders, 'Content-Type': file.type, 'Cache-Control': 'no-store' },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    },
  });
}
if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const server = serveSite({
    root: option('--root'),
    base: option('--base'),
    port: Number(option('--port') ?? 4317),
  });
  console.log(`AFM preview: ${server.url}${(option('--base') ?? '').replace(/^\//, '')}`);
}
