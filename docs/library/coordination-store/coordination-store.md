# Coordination persistence

The coordination-store component owns the SQLite implementation and its transaction
contract. The workday component owns dispatch policy and viewers. Both use the
captured assignment engine; neither authorizes candidate changes by editing state.

The database is private host state. Message insertion, readiness changes and their
event commit together or all roll back. Duplicate message IDs fail without changing
readiness. Readers require schema version 1 and exactly one initialized workday.
Status and ordered events remain inspectable after execution ends. Opening a viewer
does not initialize a missing database or resume interrupted work.

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

A task director can replace a diagnosed failed change assignment when it needs
a fresh workspace or corrected workflow. Its decision references the predecessor
ID, owner, reason and replacement change type. The host checks the checkpoint
for uncertain operations before admission. The store preserves the predecessor's
status, evidence and workspace. Its successor inherits the original owner, goal,
criteria and pending dependencies. Existing request IDs continue to identify
the same conversations. A dependent waiting for replaced work resumes on
verified delivery. Inspection records both assignment IDs and the diagnosis.

Execution transactions and read snapshots preserve their original failure even
if rollback also fails. SQLite can already have aborted a transaction after a
storage failure; its later rollback diagnostic must not conceal that cause.
This does not establish operation completion or authorize a retry (#258).
