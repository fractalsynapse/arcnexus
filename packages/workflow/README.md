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

## Recover a steward hold after independent rejection

This is implementation intent for `recover-reviewed-holds`, for Workflow
implementers and readers deciding whether a retained task can continue. It
elaborates the [Workflow contract](contract.md), especially WFL-2 and WFL-6,
within Direction's [DI-7 and DI-21 boundaries](../direction/contract.md).
It changes no architectural guidance. The current
[task executor](src/task-run.ts) returns a blocked activity immediately;
the recovery described here still needs Workflow regression and implementation
evidence. Execution's [retained hold context](../execution/src/hold-context.ts)
supplies host-observed facts; its presence alone does not demonstrate this route.

Commands submits transport-neutral input to `Workflow.run`. Execution admits the
task, Direction establishes the accepted plan, and Workflow advances its scoped
steward activities. Execution secures acknowledged changes; Coordination's journal
retains the plan, answers, activity outcomes and position. Workflow then assembles
the candidate through Execution, obtains Verification's independent assessment
and permits Delivery only after acceptance. This remains the same task lifecycle,
inside any broader Plan → Architect → every approved goal refinement cycle.

A valid independent rejection returns criterion-linked findings to Direction.
If a steward subsequently reaches a host-observed hold while correcting those
findings, preserve that originating rejection and return the exact retained hold
context to Direction as an explicit sequencing escalation. Include the unresolved
criterion, diagnostic, operation identity, expected result, actual check exit and
complete log reference when present, or the checked-edit refusal and retained
receipts. A refusal has no invented check exit. Include the accepted plan,
completed position, secured checkpoint, complete recorded answers and evidence
references. A model's claim of inability alone does not establish a prerequisite.

A repairable hold with concrete correction work continues through Direction's
existing pending revision route. Workflow does not author a replacement plan.
Use the [native revision decoder](../direction/src/native.ts) and normal plan,
revision and correction validation. Persist the accepted revision and its
originating finding before activating correction. Ordinary tool and owned check
failures still return to their caller; self-review still rewinds to the earliest
affected applicable activity in the same milestone. Neither ordinary route adds
a Director call or correction milestone.

Direction may split an oversized post-rejection correction into smaller sequential
runnable contributions. Each contribution identifies its accountable captured
owner and retains the original criterion ID, description and rejected finding.
Use applicable activities for actual work, with justified inapplicability for
others. Secure each contribution's effects, outcome and evidence before its
successor executes. Preserve completed outcomes and unaffected evidence; keep
every unmet original criterion pending. A supplier request grants no foreign
write scope, and a contribution's local measures cannot replace original
acceptance. No separate scheduler, lane, recovery store or authority path is needed.

Continuation and restart retain the same task, issue, branch, secured bytes,
answers, original rejection and acceptance. Recover from the existing journal and
checkpoint rather than creating a new task or manually repairing stored state.
Compare the returned hold with the prior correction using host-observed relevant
checked inputs and actual diagnostics. A distinct finding or meaningful relevant
checked progress permits further correction without a retry ceiling. New artifact
names, incidental transcript changes, unchanged rechecks and rephrased claims
do not demonstrate progress.

If correction returns the same hold without observable relevant progress, stop
automatic repetition before another correction attempt. Report the unresolved
criterion, exact diagnostic, retained check or edit evidence, current position and
required next action. Preserve the task for continuation when that action changes
the observed condition; restarting alone cannot authorize an unchanged repetition.
Healthy progress does not create a stopping condition.

A genuine human decision and an unavailable external prerequisite are separate
gates. Name the prerequisite, required action, evidence and retained task position.
Human decisions concern objectives, goals or architecture; ordinary correction
and sequencing add no approval gate. Stop dependent work while the named gate is
unmet. Resume the retained task only after the complete decision or external
prerequisite satisfaction is observed and recorded. An unanswered question,
elapsed time or a model assertion does not satisfy a gate. Neither a held task
nor a stopped correction reaches acceptance or delivery.

### Evidence required before claiming recovery

Testing must first expose the missing behavior through the public `Workflow.run`
path, using Execution's actual retained context and the real native revision
reconstruction and validation boundaries. Use real Git/SQLite state where restart
and secured bytes matter. Implementation follows the retained intended red;
Testing need not first complete the future implementation.

Cover independent rejection followed by a steward hold, exact diagnostic/exit/log
or receipt handoff to Direction, sequential smaller corrections with evidence
retained before each successor, and restart preserving complete answers and
original acceptance. Cover equivalent holds with different artifact names stopping
before another automatic attempt, and successive meaningful corrections continuing.
Exercise separate human-decision and external-prerequisite gates, no dependent
activation while unmet, and continuation only after observed satisfaction.

Assess the assembled corrected candidate against the original acceptance with
fresh applicable checks and an applicable independent verdict through the
[existing assembly boundary](src/assembly.ts). Reuse unaffected scoped evidence
only when its relevant inputs and environment still match; a changed candidate
requires an applicable independent verdict. A local completion claim, unchanged
rejected candidate or held outcome cannot stand in for acceptance. Controlled
provider regressions, live inference, hosted CI and observed staging delivery
remain distinct evidence. The host performs assembled verification and delivery;
this documentation establishes intent, not those later results.

### Simplification ledger: reviewed-hold restart correction

Workflow's [retained-check comparison](src/reviewed-hold.ts) reuses
`checkFailureSignature(log: string): string` from Execution's public entry.
The private `steward-check.js` import is removed. Execution owns retained-log
reading, diagnostic normalization and signature comparison; Workflow owns only
whether a new scoped observation permits continuation. No comparator, wrapper,
state store or public Workflow responsibility is added. The supplier export is
secured by receipt
`dae3bb4c1ee6280357c9d0d3d43b2f30359a16512a962a974e4f88e6e3d20501`.

The existing [prerequisite observation](src/reviewed-prerequisite.ts) is reused
unchanged from checkpoint `5a10d2cef731d963f129aa34902043ba266641c8`, receipt
`4dd1bce6d2a0a80de35adeb03d9c0b036da9485300957b8e4e6716c32eab495f`.
Host observations and complete recorded answers continue to control dependent
activation. The [ordinary failing-log regression](tests/integration/reviewed-hold-diagnostic.test.ts)
and both [gate regressions](tests/integration/reviewed-hold.test.ts) remain intact.
Original rejection, red evidence, task identity and acceptance remain retained;
this ledger records reuse, not assembled acceptance or delivery.

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
