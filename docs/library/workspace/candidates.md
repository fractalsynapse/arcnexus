# Verified candidate snapshots

General execution (#78) retains immutable Git tree/commit objects as internal
snapshots, without moving the source branch or publishing commits. A candidate
revision records its snapshot and captured architecture revision separately.
Assignment workspaces begin from a verified snapshot, not another owner's unfinished
edits. The supervising host captures snapshots with a temporary index; it never
stages user files or lets models mutate repository identity.

Reconciliation uses a three-way merge of the assignment base, latest verified
candidate and completed assignment snapshot. Conflicts preserve all three snapshots
and require attention. A successful merge is only a proposal: assembled checks and
independent review must pass before the verified-candidate pointer changes.

Checked edit requests require complete replacement content for create/update;
delete permits omitted or null content. Invalid request shape is rejected before
scope evaluation, journal creation or source mutation. The host-bound tool returns
a retained, correctable rejection so an agent can resend a valid complete batch.
This does not relax owner/stage authority, frozen regression protection, filesystem
alias checks or uncertain-transaction recovery: those failures remain fatal.

An assignment may propose changes to its owner's component definition, which is
included in that component's derived ownership. Workspace stewardship has no
additional prohibition on editing that owned file. Such changes remain candidate
proposals: the host continues using the run's captured architecture, permissions
and acceptance until a new run captures approved authority. Existing supervisors
and retained evidence are not rewritten (#252).

## Retained continuation branches (#331)

When verified staging advances, reconcile the owner's attributed changes against
that candidate in a successor worktree cut from observed staging. Keep the previous
branch, commits and unfinished worktree intact. The successor uses its own development
branch; transferring the old branch name is unnecessary and can reject valid
assembled publication history.

A recorded preparation is reusable only when its completed report, workspace identity,
settled operations and reconciled source match the retained transition. Recovery
finishes that same transition without rerunning preparation. Incomplete or changed
preparation remains blocked. Content conflicts retain both versions for owner
correction; this does not authorize automatic conflict resolution or broader writes.

For an ordinary text conflict entirely within the active change owner's component,
materialize Git's conflict-marked result in that same successor workflow. Retain
base, current, incoming and conflict evidence; tell the steward to resolve it through
checked edits. This is unfinished engineering, not a merged or verified candidate.
Unresolved markers prevent preparing a contribution. Cross-owner changes, nonregular
files and conflicts without an editable text representation remain blocked. Required
checks and independent assessment still evaluate the eventual assembled delivery.

Before director reconsideration captures its evidence, the host reconciles any
already completed preparation through that same checkpoint service. The director
then sees current eligibility rather than a stale pending receipt that encourages
unnecessary workflow restarts. Uncertain preparations remain visible and ineligible;
planning never gains permission to replay them.
