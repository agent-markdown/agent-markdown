/** Public browser-renderer options. Source content never registers executable handlers. */
export type Action = (values: Record<string, string | string[]>) => string | Promise<string>;
export interface RendererOptions {
  actions?: Record<string, Action>;
  widgets?: Record<string, (element: HTMLElement, state: RenderState) => void | (() => void)>;
  mode?: 'rich' | 'plain';
  live?: boolean;
  /** Localized complete timer phrase, including any separator. */
  formatTime?: (seconds: number, format: string, context: { state?: string }) => string;
  maxSourceLength?: number;
  /** Maximum sanitized DOM depth; defaults to 128. */
  maxNestingDepth?: number;
  /** Optional trusted diagram adapter; returns sanitized SVG, never source-provided code. */
  diagram?: (source: string) => Promise<string>;
  diagramStreaming?: 'closed' | 'checkpoints';
}
export interface RenderState {
  streaming?: boolean;
  interrupted?: boolean;
}
