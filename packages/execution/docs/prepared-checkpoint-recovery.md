# Recover a prepared checkpoint

This intent is for Execution maintainers implementing prepared-task recovery and
operators deciding whether a retained task can resume after staging moves. It
records the accepted behavior for `prepared-recovery-continuity` before its
behavioral correction. The governing obligations are
[Execution EX-11, EX-17, EX-22 and EX-25](../contract.md#acceptance-scenarios).
This document changes no contract, ownership or acceptance.

## Retain the task and its history

Resume the same task and issue selected by Direction through Collaboration.
Preserve the issue branch, secured checkpoint bytes, successful checked-edit
receipts, complete evidence and verbatim human answers, including meaningful
whitespace and line breaks. The requesting activity receives its complete recorded
answer without another prompt or duplicate acknowledged write. Replaying an
identical acknowledged edit returns its retained receipt.

Keep the original engineering base, accepted requirements and criteria, plan
position, activation authority and review observations traceable in
[Coordination's existing journal](../../coordination/contract.md). Recovery appends
observations; it does not relabel an earlier verdict, overwrite a historical base
or replace the accepted plan to escape an unresolved obligation. A checkpoint push
secures progress; it establishes neither final acceptance nor staging delivery.

## Caller knowledge across recovery

The correction intent for `recovered-caller-knowledge-correction` is to use the
existing [`callerRevision` policy](../src/research.ts) consistently for ordinary
callers, including the public [`HostTask.inboxScope`](../src/index.ts) accessor.
Activation tools, clarification replay, research replay and public inbox consumers
must identify the same actual caller conversation before and after staging moves.
Ordinary caller continuity uses the original recorded task base; it does not
replace the newly captured engineering base or authority.

This includes the consumers that reconstruct
[hold context](../src/hold-context.ts) and
[retained supplier diagnostics](../src/supplier-context.ts). A recovered hold must
retain complete verbatim answered questions, actual unanswered clarification gates,
research results and their evidence under that caller's canonical identity.
An unanswered gate must remain actionable, and a rejected supplier request must
still return its exact diagnostic to its original caller. Keeping those records
in the journal is insufficient if these consumers cannot select them.

Retained knowledge remains task input. Current captured ownership, activities,
operations and applicable acceptance govern continuation; continuity grants no
write permission or approval. Preserve the exact proposal, baseline, actor and
question binding of host-owned approval gates through `requestDecision` and
`decisionRecord`. Preserve independent review's candidate, owner-evidence,
capture and acceptance bindings. Do not apply ordinary original-base continuity
to either boundary in a way that reuses stale authorization or verdicts.

The independent rejection in `129-3-independent-caller-scope-recovery.md` supplies
the distinguishing public Git/SQLite/executable-provider/MCP regression. Its
retained branch is `f3263ec4ee08965bc10691fd09ea6a9c768b7af2`; the relevant
Execution sources matched tested snapshot
`84c010940d1f8d9abafe704f5d4a84bdc1a0c7f3`. The public scope agrees with the actual
MCP question before staging advances, then fails afterward with
`Public caller scope differs from its actual MCP conversation`. This is observed
controlled-provider recovery evidence, with controlled final delivery.

For `recovery-history-preserved` and `recovery-current-capture`, the correction
must verify that public scope matches the actual MCP conversation after recovery
and that the consumers receive complete answers, pending gates, research evidence
and supplier diagnostics. Assert the distinguishable multiline answer exactly,
without another prompt or duplicate acknowledged edit. Also retain assertions
that changed ownership prevents unauthorized continuation and that earlier
host approval or independent review cannot authorize the recovered candidate.
The earlier numeric-check correction remains accepted retained work. This note
records intent before correction; it does not claim the caller regression passes.

## Capture before continuation

Observe current staging and issue-branch state before effects. Reconcile uncertain
checkpoint pushes and the task-owned abandoned worktree before reconstructing a
fresh attempt. Execution owns this setup before stewards begin; loss of a local
directory does not authorize another issue, branch or publication.

Record the newly observed staging base and approved architecture capture, including
Team ownership, available activities, resolved operations and applicable acceptance.
Retain the earlier capture and its association with completed work. Pending requests,
MCP grants and required activity checks must use the new capture coherently.
Candidate declarations cannot authorize themselves.

Preserve the original requirements when reconciling newly applicable acceptance.
Additional applicable requirements do not silently replace earlier criteria.
A required boundary or acceptance change uses the existing architectural authority
route, with an explicit gate and retained decision evidence. Earlier approval of
a candidate, capture or exact protected proposal does not approve the recovered
candidate or a changed proposal baseline. Reuse a human answer as historical task
input without promoting it into current authorization.

Revalidate retained checked ownership and pending activities before continuation.
A changed owner, unavailable activity or unavailable operation produces a concrete
diagnostic and prevents unauthorized work. A supplier contribution is sequenced
through Direction and grants no foreign write scope. Routine owned correction and
authorized staging retry need no additional human approval.

The identities serve different purposes:

| Identity | Recovery use |
| --- | --- |
| Original engineering base | Explains the secured contribution and its history. |
| Newly observed staging base | Defines the recovered contribution's staging parent. |
| Approved architecture capture | Defines current ownership, operations and applicable acceptance. |
| Secured checkpoint | Retains acknowledged bytes and attribution before reconstruction. |
| Final candidate tree | Identifies exactly what checks and independent review assess. |
| Verification checkout | Provides a read-only assessment environment, never a substitute publication source. |

## Preserve compatible work and diagnose conflicts

Use Git's ordinary three-way merge of the secured checkpoint and observed staging.
Compatible changes, including independent changes within one file, retain both
contributions. Overlapping paths or whole-file guidance changes alone do not prove
a conflict; current authority and actual merge results determine whether work can
continue.

A textual conflict retains the secured branch and checked bytes with Git's complete
conflict diagnostic before any overwrite or ref movement. Unexpected local or remote
branch identity is also a refusal, not permission to force replacement. Resolve
conflicts through the normal accountable activity under the current capture, or
retain an explicit authority or external-prerequisite gate with its evidence.
Do not manually repair the journal or discard failed observations.

A compatible recovery records its new base and checkpoint relationship, confirms
the checkpoint through ordinary reconciliation, then reconstructs the worktree.
Another staging advance requires renewed reconciliation; a prior recovery does
not authorize using a stale parent.

## Verification and publication boundaries

[Workflow](../../workflow/contract.md) retains the activity position and routes
repair. [Verification](../../verification/contract.md) must assess the recovered
final candidate against its captured acceptance, preserving original requirements
and historical observations. Required current and affected checks and a fresh
applicable independent verdict precede delivery. Earlier approval is inapplicable
when the required tree, staging base, capture or acceptance identity changes.
Unchanged scoped evidence is reusable only when its relevant inputs and environment
match; historical approval is not refreshed by retaining its artifact.

[Delivery](../../delivery/contract.md) owns final publication reconciliation.
Execution supplies the exact branch, candidate, staging parent and retained evidence.
After a lost provider response or an outdated open PR, observe issue-branch and PR
facts before retrying effects. Reconcile the existing publication with the newly
accepted candidate and reuse its matching PR or confirmed prior merge. Conflicting
or unavailable facts prevent a success claim and preserve work for continuation.
Do not create a second delivery to escape uncertainty or stale approval.
Delivery remains pinned to the newly reviewed tree and staging parent; subsequent
staging movement returns to reconciliation.

## Source baseline and distinguishing evidence

Source inspection at revision `aae84422d50f59311f36cb0cd397c58293fe8c91` shows
[HostTask.setupWorkspace](../src/index.ts) invoking publication observation,
checkpoint reconciliation and [prepared recovery](../src/prepared-recovery.ts).
Recovery validates retained owners and pending activities through
[architecture adoption](../src/architecture-adoption.ts) and uses Git
`merge-tree`, retaining complete conflict output without moving a ref on conflict.
[Checkpoint reconciliation](../src/checkpoint.ts) observes remote heads before
pushes. [Clarifications](../src/clarifications.ts) persist exact answers and replay
them by inbox scope. These source observations do not demonstrate answer continuity
when the capture changes or the complete recovered publication path.

The public regression must secure a checked checkpoint, record a distinguishable
multiline answer, move staging and restart through real Git and Coordination state.
For `recovery-history-preserved`, assert exact resumed answer bytes, no repeated
prompt or acknowledged edit, and traceable task, issue, receipt, original base and
acceptance. For `recovery-current-capture`, assert the new base, ownership,
operations and applicable acceptance reach pending requests, with changed-owner and
unavailable-activity refusals and evidence for any required authority gate.
For `recovery-conflict-retained`, assert compatible contributions survive, conflicts
retain checked bytes and complete diagnostics before overwrite, and another staging
advance requires reconciliation.

These are intended regression observations, not a claim of passing execution.
Controlled external responses, real Git/SQLite recovery, native confinement, live
inference, hosted CI and independent delivery evidence establish different boundaries.
The production provider and single-string Agent request remain on the shared
[inspection and activation path](inspection-parity.md); web access stays at the
provider policy boundary. Native/provider evidence must identify the actual binding,
versions, request, status and complete logs; unavailable prerequisites remain gaps.
Only the host's later assembled verification and delivery can establish the final
reviewed tree, staging parent, required checks, independent verdict and confirmed
staging merge.
