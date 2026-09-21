export const siteHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export const publishedDocs = [
  'SPEC.md',
  'EXAMPLES.md',
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'FUTURE.md',
  'docs/semantics.md',
  'docs/implementation-status.md',
  'docs/inspirations.md',
  'docs/publication.md',
  'src/README.md',
  'guidelines/implementation.md',
  'guidelines/streaming.md',
  'guidelines/security.md',
  'guidelines/nesting.md',
  'guidelines/vendor-extensions.md',
  'guidelines/host-data.md',
];
