/** Local Mermaid adapter. All configuration belongs to the host. */
let engine: Promise<(typeof import('mermaid'))['default']> | undefined;
let queue = Promise.resolve();
let sequence = 0;
export function renderDiagram(source: string): Promise<string> {
  if (
    source.length > 20_000 ||
    /%%\s*\{|^\s*---|\b(?:img|icon)\s*:|url\s*\(|(?:^|[;\n])\s*(?:style|classDef|linkStyle|click)\b/i.test(
      source,
    )
  )
    return Promise.reject(new Error('Unsupported diagram configuration'));
  if (
    !/^\s*(?:flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|erDiagram|pie|timeline|mindmap|gantt|quadrantChart|journey|gitGraph)\b/.test(
      source,
    )
  )
    return Promise.reject(new Error('Unsupported diagram type'));
  const run = queue.then(async () => {
    engine ??= import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        htmlLabels: false,
        flowchart: {
          htmlLabels: false,
          nodeSpacing: 20,
          rankSpacing: 16,
          padding: 6,
          wrappingWidth: 100,
          minNodeWidth: 64,
        },
        themeVariables: { fontSize: '14px' },
        fontFamily: 'system-ui',
        suppressErrorRendering: true,
        maxTextSize: 20_000,
        maxEdges: 300,
      });
      return mermaid;
    });
    const mermaid = await engine;
    await mermaid.parse(source);
    return (await mermaid.render(`afm-diagram-${++sequence}`, source)).svg;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
