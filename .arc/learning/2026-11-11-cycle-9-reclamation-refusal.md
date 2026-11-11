# Cycle record — reclamation refused for a guessed owner

**Goal:** reclaim superseded dependency snapshots and abandoned operation scratch (#404 behaviors 2 and 3).
**Cycle:** live run `a91770f3`, base `1a92b08`, 2026-11-11. Owner candidates selected by the director:
`operations`, `workspace`, `architecture-maintenance`.
**Outcome:** refused by independent verification. Nothing integrated. Re-driven as `43aa61`… and landed on the
second attempt (run `a41d43d9`, PR #418, staging `d43aa61`).

## Observed failure

The first candidate **passed every recorded assembled check** and was still dangerous. Verifier verdict, verbatim:

> Candidate 6c854cfbf85f2d40eb8827fa79d5d18fd2b8155a passes recorded assembled checks, but legacy reclamation
> skips PID 1 and can discard scratch it claims. Correct this safety defect before integration.

The sweep treated "PID 1" and "no recorded owner" as evidence of abandonment. On a namespaced or container host
PID 1 is a live supervisor, and an unreadable field is unknown, not absent. A reclaimer that deletes on an
inference turns a disk problem into data loss.

## Cost and time

Refusal cost: one full direction pass plus four prepared milestones discarded, roughly 35 minutes of wall time and
the whole preparation of a five-file candidate. Detected **before** integration, which is the only reason the cost
stopped there. Disk at the time: 43 GB free on the root filesystem, down from 69 GB at the start of the session —
the pressure this goal exists to remove.

## Defect pattern

**A deletion path deciding from absence of evidence.** Recorded before as #393 (suites that skip instead of failing
loudly) and #400 (a rule stated in prose but never checked): in all three, a green result was produced by the absence
of something rather than by its presence. Same shape, third instance.

## Cheapest check that would have caught it

For any reclamation predicate: **require positive proof of abandonment, and assert the unknown case preserves.**
Now encoded — ownership resolves through `processOwnership(pid, start)` against recorded identity, with a deterministic
case proving a directory whose owner cannot be read is preserved. The general form for future checks: a refusal or a
deletion must cite something it *observed*, never something it failed to find.

## Proposed standard (for the architect, not adopted here)

*Deletion predicates state their evidence.* Where code removes files it did not create in the current invocation, a
review-visible predicate must name the positive observation that establishes abandonment; unknown, unreadable, or
absent metadata means preserve. Attached to the `testing`/`implementation` activities of owners that touch
application storage (`operations`, `workspace`, `report`).

## Also learned while diagnosing

The refusal left the run `needs_attention` and **invisible**: no escalation entity was created, so the report, the
counts, the direction input and the task output all correctly rendered nothing (#415), and the only way to clear the
parked lane was a store-level cancel because `task stop` itself needs the host the parked run blocks (#397).
