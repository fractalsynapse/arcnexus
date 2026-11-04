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
