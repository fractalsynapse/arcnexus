# Coordination persistence

The coordination-store component owns the SQLite implementation and its transaction
contract. The workday component owns dispatch policy and viewers. Both use the
captured assignment engine; neither authorizes candidate changes by editing state.

The database is private host state. Message insertion, readiness changes and their
event commit together or all roll back. Duplicate message IDs fail without changing
readiness. Readers require schema version 1 and exactly one initialized workday.
Status and ordered events remain inspectable after execution ends. Opening a viewer
does not initialize a missing database or resume interrupted work.

## Escalation records

An escalation records the owner waiting on another owner, the reason for the wait,
and the assignment it blocks. Its `owner` identifies the waiting owner, `reason`
contains the explanation and identifies the owner awaited, and `assignmentId`
identifies the blocked assignment. The awaited owner is conveyed in the reason text.

## General execution inbox

General execution uses the separate version-two store; version-one reports remain
readable but cannot resume under its scheduler. Requests and ordered correlated
replies are retained together in each participant's inbox projection. A resumed
recipient receives the exact answer and decision history, not only the original
request. Acceptance records intent and does not prevent later clarification.
Clarification preserves the existing plan and undelivered dependency milestone.
New decisions cannot reopen terminal assignments; exact repeated replies remain
idempotent. A second outstanding question on the same request must be answered
before another question replaces it.

Cycle detection uses the active wait graph: only unsatisfied required milestones
form blocking edges. Retained links to accepted intent or completed delivery remain
provenance and may form historical cycles without preventing runnable work. A new
unsatisfied cycle still rolls back the entire request exchange and retains an
explicit blocked outcome; an acknowledgment never substitutes for delivery.

## Concurrent portfolio initialization

Portfolio readers apply the same bounded SQLite lock-wait safeguard as writers
before inspecting schema metadata (#162). This is database contention handling,
not an engineering execution deadline. Version and table inspection share a read
transaction so concurrent initialization cannot produce a mixed schema observation.

An absent or still-uninitialized read-only registry projects empty collections and
never creates schema. Unsupported/corrupt schemas still fail explicitly. A failed
open closes its connection; reads never gain mutation authority while waiting.

A task director can replace a diagnosed failed change assignment when it needs a
fresh workspace or corrected workflow. Its decision references the predecessor
ID, owner, reason and replacement change type. The host checks the checkpoint
for uncertain operations before admission. The store preserves the predecessor's
status, evidence and workspace. Its successor inherits the original owner, goal,
criteria and pending dependencies. Existing request IDs continue to identify the
same conversations. A dependent waiting for replaced work resumes on
verified delivery. Inspection records both assignment IDs and the diagnosis.

Execution transactions and read snapshots preserve their original failure even
if rollback also fails. SQLite can already have aborted a transaction after a
storage failure; its later rollback diagnostic must not conceal that cause.
This does not establish operation completion or authorize a retry (#258).

## Ordinary direction admission and obsolete requests

Ordinary direction admission may replace dependency obligations that are no longer
required by the accepted direction. The coordination-store transition validates
that each retirement names a current request relationship owned by a continuing
assignment, and checks linked assignments' execution states in the same transaction
as admission. It rejects stale, duplicated, or unrelated request identities and
refuses retirement while the recipient is running or interrupted, or while a
correlated clarification remains in flight. A refusal leaves proposals,
continuations, requests, and the run checkpoint unchanged.

Retiring one request does not erase a dependency still required by another active
request for the same supplier. The store retires the selected request and keeps the
dependency edge until the last such request is retired. An explicit or ambiguous
pre-existing dependency link is kept even after its associated request retires.
If a preserved dependency remains unsatisfied, the continuing assignment remains
waiting until that dependency is satisfied. These cases preserve obligations; they
do not by themselves refuse admission.

Successful admission retires only validated obsolete requests and persists the
transition with the new direction checkpoint. Replaying the same admission resumes
the original validated assignment checkpoint without recreating retired requests.
The public execution-store contract exposes validation, retirement, and checkpoint
commit as one bounded transition.

Retirement extends the existing direction-admission entry point; there is no
parallel retirement admission API. Retained request records and explicit dependency
link events establish edge provenance, including for runs created before retirement
was available. Ambiguous edges remain required. One required-work projection follows
current dependency edges from director assignments and independently created work;
request-only work disconnected by an explicit retirement remains inspectable but
cannot dispatch or prevent goal assessment. Shared reachable work remains required.

## Explicit supplier linking contract (#339)

The following behavior is the accepted specification for the supplier-link change;
the regression checkpoint precedes its implementation.

An `OwnerRequest.existingAssignmentId` deliberately links existing supplier work.
The store resolves that identity in the sender's run and checks the accountable
owner. The supplier's existing objective, acceptance criteria and proposal workflow
are canonical. Linking must not require the requester to copy them, replace them
with caller terms, or fill a missing supplier workflow from the requester's workflow.

The request's `objective`, `acceptance`, `kind` and `changeType` remain durable
requester contribution purpose in the inbox envelope. They explain why the sender
needs the supplier's contribution; they grant no additional supplier scope.
For example, “use the durable linking contract in runtime admission” may link a
store assignment whose accepted objective is “implement durable supplier linking.”
Consumers inspect the linked assignment for supplier authority and the inbox
request for requester purpose. Public link validation follows these semantics.

Unknown identities, owner mismatches, foreign-run identities and self-links fail
explicitly. A refusal rolls back the entire request exchange, including earlier
new-work requests in that exchange, inbox records, milestone changes and dependency
edges. Blocking cycle rejection continues to use the existing active wait graph.

Request identity still binds the original caller envelope: exact replay returns the
same supplier, while changed purpose, acceptance, workflow or supplier identity
under the same key fails. The milestone belongs to the dependency obligation and
does not change supplier scope. Omitting `existingAssignmentId` requests distinct
new work through the existing assignment-creation path, even for the same owner.
No prose-based assignment merging or separate linking lifecycle is introduced.
