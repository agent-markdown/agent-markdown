# Nesting and performance

Support recursive disclosure and block structures in lists/task lists. Use ordinary Markdown continuation indentation and blank lines around structural HTML bodies. There is no grammar-level fixed depth limit.

Document implementation budgets. The reference uses markdown-it's nesting budget and a 250,000-character source limit; it is intended for local examples. A production renderer should apply bounded work, avoid stack overflows and preserve useful content when a resource limit is reached.

Keep layout lightweight: avoid network resolution, filesystem reads and tool execution during text layout. Cache expensive math/preview work where useful and measure real stream workloads. The reference uses one shared local timer scheduler, pausing visible-time refresh while the document is hidden.


A details element may be the list row itself: `- <details>` followed by its indented summary and body. In rich rendering, its disclosure marker replaces the ordinary bullet; do not add another label or a second visual gutter. Additional nesting should correspond to real parent-child work. Standard list output remains meaningful when enhancement is unavailable.
