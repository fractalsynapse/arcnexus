---
id: inspect-parity
priority: 30
---

# Keep inspection and live Agent requests in parity

Keep rendered and structured inspection tied to the exact shared request builder
used for every actor. Include selected activity context, source labels, and
placeholders for live-only data. Keep normal harness guidance discovery intact.

Make activity-scoped project authority auditable: expose the captured operation
identities and tool descriptions through inspection, matching the project tools
actually exposed during activation. An explicitly empty operation list exposes
no project tools. Keep built-in web access independently controlled by the
execution provider; inspecting project tools grants no additional authority.

## Success measures

Request-parity and inspection scenarios pass on the evaluated revision. Inspect
has no upstream or model effects, and its output matches activation when given
identical inputs.

Scenarios compare inspected operation identities and descriptions with the tools
exposed to the same selected activity, including an explicitly empty operation
list. Operations from other activities remain unavailable. Independent web-access
settings remain distinct from the captured project-tool list.
