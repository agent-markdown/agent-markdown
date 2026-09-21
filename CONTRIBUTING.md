# Contributing

Start with a concrete agent-output example, the current renderer disagreement and a polished fallback. Prefer existing Markdown/HTML. Include streaming prefixes and expected final output. Describe whether the change belongs in document, activity, UI, preview or a vendor profile.

Start proposals in issues or Discussions; changes to the current draft should update SPEC.md, examples and fixtures together. The TypeScript demo is illustrative, not the only possible implementation. Keep host execution distinct from document parsing.

Use the **Syntax or component proposal** issue template for a concrete change, or **Parser or renderer disagreement** for a bug. Use the [Ideas discussion form](https://github.com/agent-markdown/agent-markdown/discussions/new?category=ideas) to compare alternatives before proposing a rule.

- Keep one problem per proposal; distinguish selected draft rules from alternatives.
- Include Markdown, equivalent HTML where applicable, rendered behavior, and a readable fallback.
- Include chunk-boundary fixtures, final convergence, literal-code cases, and interaction state.
- Cite primary precedent; explain compatibility costs explicitly.
- New syntax is not accepted merely because it is implemented. Discussion, a recorded decision, examples, and cross-renderer fixtures precede adoption.
- The entire v0.1 draft is experimental. Attribute spellings and optional profiles remain reviewable; do not advertise full GFM conformance or industry adoption.

## Editing the specification

- Put requirements in SPEC.md or docs/semantics.md; label examples, rationale and implementation notes as informative. Keep one source of truth for each rule.
- Identify the subject: producer, renderer or host. State the input condition and observable result. Prefer a short rule and example to general intent.
- Reuse defined terms. Use uppercase requirement words only for deliberate requirement levels; avoid vague phrases such as “handles correctly” or “supports everything”.
- For each addition, document applicability, defaults, unknown/invalid input, literal contexts, fallback and streamed prefixes. Name dependencies on other capabilities.
- Keep examples and independent expected-output fixtures together. A passing implementation is evidence, not permission to change the grammar.
- Record intentional baseline differences, implementation deviations and unresolved questions separately. Reference upstream versions explicitly.

Editorial references: [W3C Specification Guidelines](https://www.w3.org/TR/qaframe-spec/) for scope, conformance and optionality; [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html) for requirement levels; [CommonMark](https://spec.commonmark.org/0.31.2/) and [GFM](https://github.github.com/gfm/) for example-led grammar. These inform how this draft is written, not endorsements of AFM.

## License

Contributions to the implementation, specification, examples and website use the repository's MIT license. Preserve third-party notices and attribution.
