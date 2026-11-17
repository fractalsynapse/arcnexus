# Execution

Execution activates scoped stewards, applies checked edits and supervises declared
operations in one task worktree. Its public obligations are in the
[locked contract](contract.md).

## Resumable steward checks

The following records intended behavior for `durable-steward-check-recovery` before
implementation. It implements Execution EX-10, EX-11 and EX-17 and project
[PRJ-12](../../docs/interface/arcnexus-project.md); it does not change those locks.

A steward check obligation must be recoverable independently of later failure
feedback. Retain the operation ID, original `pass` or `fail` expectation, owning
activity and recorded task position before a result can be stranded by interruption.
Retain the observed result with its exact exit status and evidence reference.
EX-10 requires command, working directory, duration and log path as well. Evidence
must remain readable after the task worktree is removed.

If interruption occurs after a failed check is recorded but before feedback is
recorded, reopening the task must recover the obligation, checked edits and last
committed activity position from the existing journal and checkpoint path. Missing
feedback must not imply success. The interrupted activity remains pending.
Recovery uses the ordinary task lifecycle, without a separate recovery service.

On retry, give the accountable steward the retained check result and readable
log. Apply any correction through checked edits, then rerun the original operation
with its original expectation even if the steward returns `checks: []`. Refuse an
attempt to change that expectation or use an operation outside captured authority.
Another unexpected result retains its own exact status and evidence alongside the
prior failure and prevents advancement. Do not replace a nonzero exit with a generic
failure code. Skipped, unavailable or inapplicable results cannot discharge a pending
recheck obligation.

A numeric result satisfies `pass` only at exit zero and satisfies expected-red
`fail` only at a nonzero exit. Expected-red checks retain these semantics across
restart; an expected nonzero result is not an unresolved failure. Only a matching
observed result discharges the obligation. Successful correction permits completion
and checkpointing of the activity; once completion is durably recorded, restart
resumes at its successor rather than replaying the completed activity.

## Checkpoint and workspace invariants

Under EX-11 and EX-17, retry reuses the existing issue and issue branch and
reconciles any abandoned task worktree before creating the attempt's worktree.
There is at most one active task worktree. Checked edits must survive removal as
retained commits with their journaled identity and attribution. Preserving edits
after failure or cancellation does not mark the interrupted activity complete.

Observe an uncertain checkpoint push before retrying it, as required by
[Coordination CO-15](../coordination/contract.md). If the remote already names the
recorded checkpoint, confirm it without repeating the push. Refuse unexpected
local or remote branch changes and mismatched task or base identities before
activation. Retain diagnostic evidence and prior contributions.

Cancellation stops managed descendants and records one terminal outcome under
EX-8. Secure checked edits before removing task-owned worktrees on termination or
restart. If preservation or ownership validation fails, retain the workspace and
report the refusal rather than deleting the remaining recoverable contents.
Remove secured task worktrees without removing the task branch or external evidence.

Checkpoint publication grants no integration authority. The assembled candidate
still requires the independent assessment in the
[Verification contract](../verification/contract.md) and the staging CI, review and
publication gates in the [Delivery contract](../delivery/contract.md).

## Required regression evidence

Execution's integration suite must establish these captured acceptance criteria:

- `interrupted-check-retained`: interrupt after recording an unexpected check
  result and before recording failure feedback, then reopen the durable task.
  Assert recovery of the original expectation, a distinctive exact nonzero exit,
  readable log contents, checked edits and pending activity position.
- `mandatory-recheck`: retry with an empty requested check list and observe the
  original check running. A repeated unexpected result must retain its exact
  status and evidence and prevent advancement. A successful correction must
  permit completion and successor resumption. Exercise expected-red semantics
  across interruption as well.
- `checkpoint-invariants`: retain coverage for observing a lost push response
  before retry, edits surviving worktree removal, reuse of one issue and branch,
  one active task worktree and cleanup after preservation.

The supplied owner-suite baseline (`85-1-owner-tests.log`) reports seven passing
and two skipped tests, with no failures. Its checkpoint regression covers a lost
push response, cleanup and successor resumption. Its steward-check regressions
cover correction after feedback and a repeated failure; they do not interrupt
between result recording and feedback or reopen that failed task. At that baseline,
`pendingStewardCheck` recovered obligations from later supplier feedback, while
`HostTask.check` recorded the check result without its original expectation. This
left the specified interruption window unproven and motivated the change.

The skipped tests cover confined command execution and disposable-overlay writes;
the baseline does not establish those observations in this environment. Its fake
provider and command boundaries also do not establish hosted CI, live inference or
staging integration. Later owner-suite evidence must report applicable skips and
these limits. This documentation records intent only; the documentation activity
declares no operations and does not establish behavioral acceptance.

## Recovery function correction

The `steward-check-recovery-function-correction` milestone addresses the
`durable-steward-check-recovery` self-review finding: `pendingStewardCheck` in
`src/steward-check.ts`, lines 17–58 in the captured checkout, exceeds the
[TypeScript standard](../../docs/foundation/typescript-standard.md)'s 30-physical-line
function limit. Acceptance `recovery-function-standard` requires meaningful,
separate functions for observation-based recovery and feedback-based recovery,
with explanatory headers and each within that limit. This is a behavior-preserving
refactor under Execution ownership; the captured acceptance, authority and locked
contracts remain unchanged.

Preserve observation precedence: the latest numeric check observation for the
owner and activity with a recorded expectation determines whether recovery is
pending. A result matching that expectation ends recovery without falling back to
older feedback. Only when no qualifying observation exists does recovery use the
latest matching supplier feedback and look for a subsequent matching numeric
result for that check. Preserve the original expectation, exact status and log
reference when returning an unresolved obligation.

Retain the supplied evidence by basename within the task's external evidence
record. `85-5-owner-tests.log` is the expected-red regression baseline: seven tests
passed, four failed and two were skipped. The failures expose missing recovery
before feedback for both expectations and advancement despite omitted rechecks.
The pass-expectation interruption retained exit 37; the fail-expectation
interruption retained exit zero, which does not satisfy an expected-red check.
These failed observations must remain available after correction.

`88-3-owner-tests.log` is the passing owner-suite baseline before this refactor:
11 tests passed, none failed and two were skipped. The interrupted-check scenarios
exercise both original expectations, readable retained logs and checked edits,
mandatory rechecks despite `checks: []`, repeated unexpected results, successful
correction and successor resumption. The pass-expectation scenarios distinguish
initial exit 37 from repeated exit 43; successful expected-red correction exits 37.
The suite also retains the checkpoint regression for observing a lost push response
before retry and preserving committed edits through worktree removal.

Acceptance `recovery-correction-evidence` requires a subsequent authorized
`owner-tests` observation (`npm test -- execution`) after the refactor. Retain both
baselines and the new result; report any failures and skips without weakening the
criteria. The passing baseline still skips confined command execution and
disposable-overlay writes. Its simulated provider, harness, command and review
boundaries do not establish native confinement, hosted CI, live inference or actual
staging integration. No operation is declared for this documentation activity, and
this intent record does not claim that the refactor or its verification is complete.
