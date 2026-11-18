# Prepared checkpoint recovery intent

Status: intended behavior before implementation for
`recover-prepared-checkpoint`, Part of #594. This is the first scenario of the
[approved standing goal](../../../.arc/goals/recover-moved-staging.md). It covers
an admitted task with a secured issue-branch checkpoint when staging advances
disjointly, before any PR or final-candidate publication attempt. A checkpoint
push is permitted by the [Delivery obligations](../../delivery/contract.md#obligations);
it does not constitute final-candidate publication.

This intent implements [Execution EX-11 and EX-17](../contract.md),
[project PRJ-4 and PRJ-12](../../../docs/interface/arcnexus-project.md),
[Architecture ARC-7, ARC-11 and ARC-17](../../architecture/contract.md), and
[Coordination CO-9 and CO-15](../../coordination/contract.md).
It changes no locked contract. Changed authority is refused in this increment;
the standing goal's broader authority-change and open-PR scenarios remain outside
this deliverable.

## Observe before changing a ref

Through the existing Execution checkpoint boundary, observe the retained local
and upstream issue branch, the secured checkpoint and the latest staging commit.
Reconcile uncertain checkpoint effects before retrying them. Confirm that task,
issue, branch, original base and checkpoint identities match the retained journal.
Confirm that no final-candidate publication has begun and that the task has no
published candidate or PR. Missing or conflicting observations prevent recovery.

Compare the retained capture with inputs from the observed staging revision before
mutating the issue branch. Recovery requires equivalent effective architecture,
ownership, activity authority, operations, check definitions and expectations,
acceptance, native project guidance, bindings and trusted composition. Keep the
admitted capture authoritative: observing newer inputs cannot widen permissions,
replace checks or rewrite requirements.

Compare effective locked contracts by identity, path, locked status and actual
bytes, validating their registry identities. A changed or missing locked contract
is incompatible. A proposed documentation digest change alone is not evidence
of a new locked interface: distinguish proposed records from effective locks,
and still compare any applicable authority, guidance and acceptance inputs.
The approved goal or objective addition may change proposed documentation digests
without changing those effective inputs. Disjoint recovery implementation and its
approved PR may also be present on staging without invalidating the prepared
candidate merely because the source revision differs. Neither case permits
changed authority, guidance, acceptance, check definitions or trusted composition.

## Preserve and reconstruct

Recover using the same task, issue and issue branch. Retain the original capture,
base, checkpoint, checked-edit receipts, attributions, verbatim human answers,
committed cursor and all earlier evidence as history. Preserve checked file bytes
and their digests. Do not replay a completed activity or request its answer again;
[Workflow](../../workflow/contract.md) continues from the recorded successor.
Pending check obligations retain their original expectations and remain pending.

Construct a reconciliation commit that incorporates the observed new staging
parent and retains the secured checkpoint as an ancestor. Preserve the disjoint
staging contents as well as the checked candidate contents. Reconstruct a fresh
task worktree from that verified commit through the normal attempt lifecycle,
with at most one active task worktree. Advance the existing issue branch only
after compatibility, overlap and branch-state validation succeeds, conditional on
the observed branch identity still matching. Further branch or staging movement
requires another observation and reconciliation, not a blind retry.

A mismatch between recorded and observed bases remains a refusal unless this
compatible prepared-checkpoint path establishes the new engineering base.
Recording the new base does not replace the admitted authority capture.
Cancellation uses EX-8 and the existing preservation-before-cleanup path; if
preservation fails, retain recoverable contents and diagnostic evidence.

## Refusal and fresh gates

Refuse overlapping staging changes to checked paths even if Git could merge the
text automatically. Also refuse changed authority or check definitions,
incompatible guidance or acceptance, unexpected issue-branch state, mismatched
task or checkpoint identity, and an already published candidate or publication
attempt. Do not reconcile an open PR in this increment. Each refusal leaves the
issue branch unchanged by reconciliation and preserves the checkpoint contents,
task identity, answers, cursor and evidence. Retain conflicts and the exact reason
for correction through the existing owner and Direction boundaries.

Completed work can be reused only after capture compatibility is established.
Earlier checks and review remain historical evidence, not approval for the new
tree or parent. The recovered assembly must identify its new commit, tree and
observed staging parent. The host runs all existing assembled checks and obtains
fresh independent assessment against the captured acceptance under
[Verification](../../verification/contract.md). Delivery remains pinned to that
accepted tree and parent under [Delivery DE-1 through DE-5](../../delivery/contract.md).
Required CI, configured review and publication gates remain in force.

## Required engineering evidence

Use one Execution-owned engineering milestone where possible. Before correction,
retain a failing public integration regression using real Git and durable task
state through the existing Execution and Workflow boundaries. Secure an approved
goal or objective addition, retain a human answer and cursor, advance staging
disjointly, and reopen the task. The passing observation must establish:

- The same task, issue and issue branch, a fresh worktree, identical checked-file
  digests and verbatim answer, and continuation at the recorded successor without
  replaying completed work.
- Known original base, secured checkpoint, observed new staging commit, recovered
  commit and tree; actual ancestry retains the checkpoint and incorporates the
  new staging parent, with disjoint staging file contents preserved.
- Equivalent effective capture inputs, including actual locked identities and
  bytes; distinguish a proposed documentation digest change and permit disjoint
  recovery-code changes without weakening validation.

Use real Git refusal scenarios for an overlapping checked path, invalidated
authority or check definitions, unexpected issue-branch state and a published
candidate. Observe unchanged branch heads, secured file digests, task identity,
answer, cursor and retained evidence after each refusal. Source assertions alone
do not establish these outcomes.

Preserve existing checkpoint and interrupted-check coverage. Engineering
self-review records attribution, simplification choices, exact owner-check exits,
readable logs, retained failing and passing observations, skips and evidence
limits. Owner checks do not substitute for fresh host candidate checks,
independent review, CI or observed delivery. This intent document claims no
passing behavioral regression or delivered recovery capability.

## Simplification ledger

- Reuse Execution's checkpoint reconciliation, checked-edit receipts, attempt
  worktree lifecycle and cancellation path; add no separate recovery service.
- Reuse the immutable Architecture capture, Coordination journal and Workflow
  cursor; add no replacement capture, store, scheduler or replay mechanism.
- Add only the necessary Execution responsibility: validate compatible moved-base
  recovery before branch mutation and reconstruct the checkpoint on the observed
  staging parent while retaining ancestry and checked bytes.
- Reuse Verification and Delivery unchanged for fresh candidate gates. Exclude
  authority migration, open-PR reconciliation and publication recovery.
