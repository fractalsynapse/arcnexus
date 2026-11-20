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

## Refinement delivery status

The approved Plan → Architect → Run capability is being implemented in
[#615](https://github.com/fractalsynapse/arcnexus/issues/615). Its command surface,
high-level approvals, prerequisite delivery and durable phase recovery are targets
in the contract. The [refinement implementation intent](refinement.md) records
sequencing, recovery, shared lifecycle and reports before behavior changes. It
also defines the target public completed-round observation and a deterministic
consumer scenario for Execution; that handoff is unavailable until the subsequent
Workflow testing and implementation activities establish it. Their availability
and three-round live acceptance must be established separately from local
activity repair.
