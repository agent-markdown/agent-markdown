# Security

- Sanitize final transcript HTML and generated SVG; Markdown parsing is not sanitization.
- Treat document attributes as data, never permission or executable code.
- Register action handlers and widgets explicitly; validate inputs and authorization in the host.
- Isolate previews with an empty sandbox and restrictive CSP; no network, scripts, forms, or parent access.
- Reject Mermaid source configuration and enforce strict mode plus text/edge limits.
- Bound document size and nesting; scope identities and protect stale interactions.
- Test malicious markup and lifecycle transitions. Production adoption needs a separate security review.
