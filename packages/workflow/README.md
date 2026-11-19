# Workflow

Workflow drives the sequential host lifecycle through the public Agent, Direction,
Execution, Verification, Delivery and Coordination boundaries. Commands adapts
that lifecycle to callers. See the [contract](contract.md) for accepted target
behavior and its current proposed stage.

## Recover at the accountable activity

Ordinary operation failures return to the caller. Failed steward checks return
their exact diagnostic, expectation and log to the same milestone. A self-review
finding chooses the earliest affected applicable activity: documentation for
intent, testing for assertions, or implementation for code. The host validates
and persists that rewind with its finding before activating it.

Only affected downstream activities replay. A repeated unchanged finding with
unchanged inputs holds before another identical correction. No local repair
changes the owner, acceptance, operations or milestone sequence. Complete answers,
single-file receipts and original failure evidence remain available.

Direction plans initially and revises on an explicit escalation or final
independent rejection. A local repair does not invoke Direction. The
[rewind scenarios](tests/unit/activity-repair.test.ts) and
[supplier scenarios](tests/unit/supplier-order.test.ts) exercise those distinct
routes through the public Workflow entry.

## Bounded revision contribution

The [contract's bounded revision handoff](contract.md#bounded-director-revision)
records intended behavior for DI-21 and BWR-1 through BWR-3 before behavioral edits.
WFL-11 and WFL-12 require public supplier-escalation and final-rejection evidence;
this documentation does not establish their implementation.

Reuse the completed Coordination contribution: its public `revisionSnapshot(observations)` supplies the accepted plan, committed
cursor and full observations. The complete supplier answer is retained in
`51-25-codex.jsonl`. It specifies one capture from `HostTask.observations()`
before `HostTask.store()` allocates accepted-plan and retained-evidence artifacts.
See [Coordination's composition guidance](../coordination/README.md).

Direction must supply the missing public revision boundary before Workflow can
use it. Its current `direct()` options accept `plan`, `feedback` and `standing`,
but no immutable plan/evidence references or committed cursor.
`decodeDirectorResponse()` accepts complete plans; `validateRevision()` checks
two complete plans. Neither exposes pending-only decoding and reconstruction.
The required public contribution must accept revision references and position
for native activation and reconstruct and validate a pending response against the
retained plan and completed Steps. Direction owns that single implementation;
Workflow consumes it before commit and retains the context for same-activity
repair. The paused `bounded-director` requester owns that contribution; no
Direction-owned file is edited here.

## Refinement delivery status

The approved Plan → Architect → Run capability is being implemented in
[#615](https://github.com/fractalsynapse/arcnexus/issues/615). Its command surface,
high-level approvals, prerequisite delivery and durable phase recovery are targets
in the contract. Their availability and three-round live acceptance must be
established separately from local activity repair.
