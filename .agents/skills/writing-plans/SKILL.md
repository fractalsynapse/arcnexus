---
name: writing-plans
description: Use when an agreed capability needs a multi-step implementation plan; not for routine edits.
---

# Plan a coherent implementation batch

Read the accepted charter/design and current repository. Do not re-open settled
questions. Plan the accepted batch across its necessary responsibilities; later
phases stay brief. Follow the cadence in [AGENTS.md](../../../AGENTS.md).
Do not fragment a working lifecycle into tiny PRs with repeated long test cycles.

Use the issue for a short plan, or `docs/plans/<topic>.md` when a durable plan helps.
Include:
- Goal and the user-observable acceptance scenario.
- Affected responsibilities/files and the public boundary that must stay stable.
- Ordered dependencies: document changed intent, implement with meaningful tests,
  qualify the assembled result, review and integrate. Identify focused checks useful
  during development and the long suites deferred to final qualification. Refactors
  preserve existing contracts; add characterization where it closes a real gap.
  Fold setup into the behavior it enables; do not invent changes to satisfy a template.
- Relevant failure cases, concrete verification commands once known, and explicit
  exclusions/open decisions. Never invent commands for a nonexistent application.

Specify public contracts precisely where necessary. Leave internal signatures and
function decomposition to implementation unless another component depends on them.
Do not prewrite the implementation or produce a plan larger than the capability.

Default to native sequential execution within existing authorization. No required
execution framework, subagents, or execution-method question. If the user asked only
for planning, deliver the plan and stop before implementation. If implementation is
already authorized, proceed once material architectural questions are resolved.
