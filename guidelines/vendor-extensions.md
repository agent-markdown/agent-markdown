# Vendor extensions

Use native HTML attributes when their existing meaning matches. Shared AFM semantics use `data-afm-*`; provider metadata uses `data-<provider>-*`. Do not add bare `afm-*` aliases or redefine native attributes. IDs are optional and document-local.

Use ordinary links when the destination already identifies an entity. Optional data-vendor-* fields add metadata. Keep visible labels out of attribute-only storage. Prefer qualified type/action values such as example:changes and example:answer.

A generic card preserves its child content. A vendor-specific card can render through the widgets option of AFMRenderer, keyed by data-afm-type or a custom tag name. Widgets may return a cleanup function. They run only after finalization. Default child content is inert and sanitized; registered widget code is trusted host code.

Unknown vendor widgets marked data-afm-fallback="omit" disappear in the AFM renderer/exporter. Other sanitizers may ignore the hint. A vendor may define a custom semantic tag, but must document its fallback behavior and cannot claim universal subtree omission across unrelated HTML parsers.

Adapters to Inline/Telegram/Codex should preserve fields that have no exact shared equivalent. For instance, a denied action is not automatically interchangeable with a user-cancelled task. Keep source identities, timestamp units and vendor-specific distinctions explicit.
