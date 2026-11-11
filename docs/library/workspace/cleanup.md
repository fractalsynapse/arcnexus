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

Resource projections include the separate cleanup receipt. A removed workspace reports
its current removed status while preserving the original execution status; recording
cleanup changes the resource revision without rewriting the historical run report.

## Operation scratch reclamation (#404)

Operation scratch belongs to its preparation/execution record. Once that record
reaches a terminal state and its operations and managed resources have stopped,
remove both its recorded operation temporary root and sibling configuration
directory. Keep both while the record is running, prepared for continuation, or
operation shutdown is unresolved. Completed, failed and cancelled records use the
same disposal rules. Saving retained evidence must finish before scratch removal,
and repeated cleanup is safe.

The public workspace module exposes `WorkspaceReclamation`.
`new WorkspaceReclamation(applicationRoot).reclaim()` provides the bounded
reclamation pass needed by host startup. It inspects recorded resources from earlier
hosts on this machine, including resources belonging to another project; a directory
name, elapsed time or terminal status alone is insufficient authority. Require
positive record/resource identity and established absence of live process ownership
before deletion. Preserve resources owned by any live host or operation, and preserve
resources whose identity or process ownership cannot be established. Unknown workspace
owners and prepared contributions are retained. Saving a later contribution checkpoint
refreshes the workspace process owner. Reject aliases, replaced paths and
source/evidence overlaps before any removal.

Retained workspace reclamation uses the existing repository identity, revision,
output, service, execution retention and publication guards. Abandonment alone
does not release authored changes, active references or pending delivery inputs.
Reclaim only disposable resources that satisfy those guards; preserve the branch
and any retained engineering material. Record removals separately from original
execution evidence, including enough identity to explain what was reclaimed.

Scratch reclamation preserves activation journals, invocation logs, artifact
copies and reports in application storage. The private-home confinement redirect
continues to use the operation temporary root and its read-only configuration
sibling. No retained evidence is moved into disposable scratch.

Host-start invocation belongs to the execution-runtime integration. This change
adds no cleaner daemon, TTL service or store, does not implement #404's prepared
dependency snapshot bound, and changes no verification, delivery, release or human
gate authority.
