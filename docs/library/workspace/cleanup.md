# Interrupted workspace cleanup

Cleanup persists versioned ownership intent before removing worktrees. Member
progress and primary removal are recorded separately from immutable run reports.
A retry may reconcile an absent primary only with matching durable intent, no Git
registration, accounted-for dependency removals and confirmed resource shutdown.
Replaced paths, unexplained disappearance and ambiguous ownership are refused.
Existing completed receipts remain supported. Branches and reports are preserved.
A stale execution lock still requires caller inspection; cleanup does not resume
assignments or automatically recover interrupted execution.

## General execution retention

A workspace linked to a general task/workday (`executionRunId`) or assignment
(`assignmentId`) remains retained even when its worktree is clean or its local
preparation record is no longer running. Reject cleanup before creating removal
intent, stopping resources, deleting files or changing Git registrations. These
links capture execution retention, not a claim that active inference is occurring.

This guard conservatively includes completed deliveries and superseded execution
workspaces. Collection requires a future explicit release-of-retention decision;
absence of edits is not proof of disposability. Standalone preparation cleanup
continues to use existing ownership, output, service and recovery checks (#158).


## Retained workspace resource queries

The workspace application service exposes read-only discovery independently of a
checkout, terminal or execution host (#160). `workspace list [package]` returns
managed workspace projections with shared search, pagination and revision tokens.
`workspace get <id> [--follow]` returns retained status and ordered events; `--after`
is an exclusive event cursor when following. Interrupting a follower only detaches.

Queries never create state, recover hosts or change cleanup eligibility. Operation-only
receipts whose working directory is source are not managed workspaces. Historical
workspace receipts remain inspectable. Package membership comes from captured selected
package/preparation context; unknown historical membership remains visible as unknown
in unfiltered queries and is not silently attributed to a requested package.

Workspace owns the resource service and exports it through its existing public module;
report supplies common pagination and timeline parsing. CLI resolves optional portfolio
targets and renders structured results. Raw harness content and local binding secrets
are excluded from these resource projections. Mutation commands continue through the
existing preparation/cleanup lifecycle until their grouped adapters are migrated.
