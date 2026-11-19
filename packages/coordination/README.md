# Coordination revision snapshots

This records the intended contribution for bounded Director revision (DI-21);
the public regressions and implementation are pending. The
[locked contract](contract.md) remains authoritative. Its obligations to persist
plan and position, retain authored evidence and expose artifacts by identity
govern this contribution, especially CO-7, CO-11, CO-15, CO-16 and CO-20.

## Existing boundaries

`Journal.retained` contains ordered observations from prior attempts at the same
logical task. `Journal.events()` reads the current attempt in write order.
Their concatenation is the complete retained observation stream at the time of
the read. The journal remains the sole authority; a rendered plan, prompt,
artifact or in-memory cursor does not become another plan store.

Execution's public `HostTask.observations()` already composes those two sources.
`HostTask.history()` exposes the Workflow history after the latest
`plannerRefresh` boundary. Use that history scope to resolve the active accepted
plan and committed position; keep the full observation stream for evidence.
`HostTask.store(name, contents)` writes an immutable, exclusively created artifact
outside maintained source and returns its readable path. Artifact reads use the
existing bounded read operation (CO-11).

## Smallest public contribution

Coordination will expose a detached revision view derived from ordered journal
observations. It will return the exact latest accepted structured plan and the
last committed position for that active history, together with the full retained
observations needed for a boundary snapshot. It will not render or summarize the
plan, infer acceptance from a rejected Director reply, or discard observations
from earlier attempts.

The position uses Workflow's existing vocabulary: `completed` counts the leading
completed milestones; `activities` maps stable milestone IDs to their next Step
index. An absent activity position means zero. Completed Steps precede that index,
including within a pending milestone. A final independent rejection may therefore
have no pending original milestones while still requiring new correction work.
A supplier request preserves the requesting activity's unfinished position.
A recorded repair rewind is a committed position, not permission to erase earlier
receipts or answers.

The view preserves accepted milestone identities, accountable owners, original
criterion IDs and descriptions, completed milestone outcomes and completed Steps.
It exposes facts for Direction's reconstruction and validation; Coordination does
not choose a new sequence or decide which engineering work satisfies a finding.
No new writer, database, persisted cursor or authoritative plan version is added.

## Immutable reference composition

At explicit escalation or final independent rejection, the native host composes
the Coordination view with `HostTask.store()`. It serializes the exact accepted
plan and full retained evidence into immutable artifacts and gives Direction their
readable references with the completed/pending position. The current relevant
finding remains explicit. The Director can read the references without receiving
the completed plan prefix inline or regenerating it.

Capture the observations once before allocating the snapshot artifacts, since
artifact allocation itself records a new observation. The plan, position and
evidence must describe that same boundary. Retain every observation in order,
including failed and unavailable checks, complete recorded answers, edit receipts,
activation outcomes and artifact references across attempts. Preserve referenced
transcripts and logs in their existing artifact storage; a snapshot must not
substitute excerpts or successful-only evidence for them.

Later journal writes, artifact allocation, returned-object mutation or a subsequent
attempt must not change the captured view or stored artifact bytes. Snapshot
identity denotes the exact serialized content at that boundary, not a mutable
pointer to the latest plan.

Direction consumes these references to request only necessary pending work and
validates the reconstructed plan against captured authority, original acceptance
and completed work. This replaces the native full-plan revision prompt payload;
initial planning, same-activity invalid-response repair and the shared
transport-neutral task lifecycle retain their existing responsibilities.

## Public regression intent

BAR-1 through BAR-3 require public evidence for a resumed task with multiple
attempts: the selected plan equals the accepted structured plan exactly, the
committed milestone and Step positions survive, and full evidence includes failed
observations and complete answers. Capture a snapshot, append further observations
and mutate a returned view to demonstrate that retained facts and prior snapshot
bytes remain unchanged. Exercise both a paused supplier and final independent
rejection, including a large completed prefix, so references cannot silently
become an inline completed-plan payload.

The completed supplier answer must identify the delivered Coordination public API
and show its composition with `HostTask.history()` /
`HostTask.observations()` and `HostTask.store()` before Direction resumes.
This document records intent; it does not establish that the new view or those
regressions have been delivered.
