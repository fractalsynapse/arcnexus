# Assignment-bound command diagnostics

Engineering activations use the existing `assignment.evidence` capability to discover current-run intent and, when available, read retained command diagnostics. The host binds diagnostic reads to the current assignment, run, and retained record. Worker-provided references do not select another record or grant execution permissions.

Read the manifest's `invocationDiagnostics` entry, then fetch only the invocation artifacts it advertises through the same evidence paging capability. Each invocation retains its identity, status, exit code, resolved context, and complete combined output. Missing, mismatched, or unsafe retained data is reported as unavailable evidence.

Continuation preserves the assignment's evidence route and invocation history. Read diagnostics from the retained invocation; do not rerun the command to recover output. Intent discovery, evidence history, and diagnostics remain in the same capability.

## Explicit supplier links

A requester first reads the current run's assignment manifest and the supplier's full intent artifact. An explicit `assignmentId` selects that existing assignment's canonical accepted contract. The request may explain the caller's contribution need in different words and give caller-specific criteria; these remain request purpose and cannot replace or enlarge the supplier's objective, acceptance, accountable owner, or workflow.

Runtime admission validates the full request batch before routing requests or accompanying inbox actions. It checks the supplier identity, same-run membership, accountable owner, and self-link rule. Invalid links retain actionable request-correction evidence without creating assignments, inbox entries, or partial dependencies. The coordination store resolves the canonical supplier contract through its ordinary transactional request path, and the scheduler preserves its existing cycle and replay checks.

The existing inbox retains the requester purpose while assignment evidence retains the canonical supplier contract. Exact replay is idempotent; changed content under the same request identity is rejected. Blocking cycles remain rejected. Distinct work uses `assignmentId=null` and creates a distinct assignment even when that owner already has work. Accepted intent can release only an accepted-intent wait; a delivered wait requires verified delivery evidence. Strengthening an existing accepted-intent wait uses `require_delivery` with the same inbox request identity, rather than creating another supplier assignment. A weaker later request cannot downgrade an existing delivered wait.

Lifecycle regressions cover discovery from the manifest, differing-wording links, invalid link evidence, replay and cycles, distinct work, and accepted-intent versus verified-delivery milestones. They exercise the existing runtime admission, inbox, coordination store, scheduler, and assignment evidence paths. No separate link registry or delivery path is involved.

These semantics are specified and implemented in the runtime and coordination-store contributions. Their combined behavior must pass the assembled lifecycle and owned checks before delivery is verified.
