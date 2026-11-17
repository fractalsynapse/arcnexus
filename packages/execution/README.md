# Execution

Execution activates scoped stewards, applies checked edits and supervises declared
operations in one task worktree. Its public obligations are in the
[locked contract](contract.md).

## Activity-scoped operation recovery

The [operation and recovery proposal](https://github.com/fractalsynapse/arcnexus/issues/562)
routes project operations through the current activity's local MCP tools. The
execution provider independently controls its built-in web access. A refused
checked edit tells the requesting steward which path was refused and who owns
it. A refusal grants no authority. The steward can correct its request or
request a contribution through the existing Direction path.

The task journal retains each clarification with its requesting actor and
position. The same activation resumes with the exact answer. Reopening the task
reads the retained answer before calling the actor and preserves the candidate
and its check evidence while a Reviewer question is open.

Inspect exposes the captured operation IDs and tool descriptions for the selected
activity. Each `checked-edit` call handles one file and returns its before and
after digests. Later refusals leave those receipts and checkpoints available.
Remote branch publication still advances through the regular activity checkpoint.

## Research inbox recovery

After interruption, retained completed research reports are replayed to the
requester when its original activity resumes, without launching research again
for the resolved request. Optional research runs in the same sequential lane and
returns to the requesting activity, as required by the
[Execution contract](contract.md#obligations).

[ResearchInbox](src/research.ts) reloads journaled requests and completed results;
[actor activation](src/activation.ts) uses the same invoker for research and the
requester. The [research inbox integration tests](tests/integration/research-inbox.test.ts)
cover optional research returning to the original scope, replay after interruption
without another research activation, and completion without requesting research.
These local implementation and test references support this documentation; no
new test execution is claimed.

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

## Satisfied-observation precedence correction

The distinct `steward-check-observation-precedence-correction` milestone addresses
feedback from the paused `steward-check-recovery-function-correction` review and
its `recovery-function-standard` criterion. Self-review found that the refactor
violates the observation precedence specified above: at
`packages/execution/src/steward-check.ts:64` in the captured checkout,
`observed ?? recoverFeedbackCheck(recorded, scope)` conflates an absent qualifying
observation with a qualifying observation whose expectation is satisfied. Both
produce `undefined` from observation recovery, so the fallback can resurrect older
supplier feedback. The refactor is therefore not yet established as behavior
preserving.

Acceptance `satisfied-observation-precedence` requires these distinct outcomes:

- Supplier feedback for failed check A followed by a satisfied observation for
  check B under the same owner and activity returns `undefined`. The qualifying
  observation takes precedence even though its check ID differs from A.
- With no qualifying observation, feedback recovery remains available through
  the existing matching-feedback and subsequent-result rules.
- A qualifying unresolved observation returns its original expectation, exact
  numeric status and evidence reference. It remains pending until correction
  satisfies that expectation; expected-red semantics remain unchanged.

Acceptance `precedence-function-standard` keeps the correction within
`packages/execution` and the existing journal, checkpoint and recovery path.
Preserve captured authority and meaningful separation of observation recovery and
feedback recovery. Each function must retain an explanatory header and remain
within the TypeScript standard's 30-physical-line limit. The correction grants no
new operation, acceptance, verification or staging authority.

Retain `89-3-activity.diff` and `89-4-codex.jsonl` as the refactor and self-review
feedback evidence in the task's external evidence record. Retain
`89-2-owner-tests.log` as the baseline reporting 11 passed, zero failed and two
skipped tests. That passing suite does not establish the satisfied-observation
precedence case. Preserve earlier failed observations, including
`85-5-owner-tests.log`, alongside subsequent correction evidence.

Acceptance `precedence-correction-evidence` requires a regression that fails on
the A-then-B case before correction and passes afterward. An authorized
`owner-tests` observation (`npm test -- execution`) must then pass, retaining its
exact exit status and readable evidence. Preserve coverage for interrupted
recovery, both expectations, exact statuses, retained edits and logs, mandatory
retries, repeated failure, correction, successor resumption and checkpoint
invariants. Report failures and skips explicitly. The baseline's two skips and
simulated boundaries leave native confinement, hosted CI, live inference and actual
staging integration unproven.

Keep the linked recovery-function review paused until this correction passes,
then resume that review before continuing the original recovery review. The later
task-level independent verdict and staging gates remain required. This activity
records intent and retained evidence only; it declares no operations and does not
claim that the precedence regression, correction or behavioral acceptance has
passed.

## Post-format function correction

The distinct Execution-owned `steward-check-post-format-function-correction`
milestone records the correction required by the
[retained activity diff][post-format-diff] and [self-review feedback][post-format-review].
The feedback milestone and requester both identify the existing
`steward-check-assembled-quality-correction` milestone. Preserve that milestone
and its completed Steps, and insert this runnable supplier correction before its
paused review. Preserve the existing Focus, completed milestones in order,
completed Steps and recorded successor. The director performs no edits and grants
itself no write authority.

The reviewed correction left
`tests/integration/check-observation-precedence.test.ts` unchanged despite its
recorded formatting rejection and formatted `tests/integration/checkpoint.test.ts`
instead. After formatting, functions in
`tests/integration/interrupted-check.test.ts`, including `observeCheck` and
`retryProposal`, exceed the TypeScript standard's 30-physical-line limit.

Acceptance `post-format-function-compliance` requires correcting the remaining
formatting failure and meaningfully separating the oversized functions into
behavior-preserving responsibilities with explanatory headers. Inspect physical
lengths after formatting, including comments and blank lines. Preserve every
recovery assertion, captured authority and existing check definition. All changes
remain within `packages/execution`; the locked contracts remain unchanged.

Acceptance `post-format-correction-evidence` requires fresh authorized Execution
owner-suite evidence and fresh host observations of all required assembled checks,
including repository format and lint, for the corrected candidate. Retain exact
exit statuses and readable logs alongside earlier failed observations. The retained
`91-6-owner-tests.log` reports 17 passes, zero failures and two native-confinement
skips; it does not establish passing assembled format or lint checks. Preserve the
prior format and lint failures, both exit 1, and all recovery and checkpoint
characterization. Report skips and evidence limitations, including simulated
boundaries that do not establish native confinement, hosted CI, live inference or
actual staging integration.

An unresolved required failure leaves the correction pending with checked edits,
its exact exit status and readable evidence preserved. Resume the existing
assembled-quality milestone at its paused review only after this correction
passes, without replaying completed Steps or replacing the recorded successor.
The checkpoint and workspace invariants above continue to apply. Independent
verification, required CI and review, and staging gates remain required. This
documentation activity declares no operations and establishes intent only.

[post-format-diff]: /home/adrian/.local/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/420da43f22b23e9b563b916913ddc63897341bc719a2713bf569b593233f288f/91-7-activity.diff
[post-format-review]: /home/adrian/.local/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/420da43f22b23e9b563b916913ddc63897341bc719a2713bf569b593233f288f/91-8-codex.jsonl

## Assembled quality rejection

The appended Execution-owned `steward-check-assembled-quality-correction`
milestone records an assembled-quality rejection against
`precedence-function-standard` before correction. The rejected assembled contents
are retained in [89-17-candidate.diff][quality-candidate]. Preserve both failed
check observations and their readable evidence:

- [89-20-repository-format.log][quality-format]: `repository-format` exited with
  exact status 1. Formatting failed in `packages/execution/src/steward-check.ts`,
  `packages/execution/tests/integration/check-observation-precedence.test.ts` and
  `packages/execution/tests/integration/interrupted-check.test.ts`.
- [89-21-repository-lint.log][quality-lint]: `repository-lint` exited with exact
  status 1. The unused `hostTask` import at
  `packages/execution/tests/integration/interrupted-check.test.ts:19:31` violates
  `@typescript-eslint/no-unused-vars`.

These observations establish the failures for a behavior-preserving formatting
and unused-import correction; no new behavioral regression is required. Preserve
all existing assertions and failed and passing regression evidence for observation
precedence, absent-observation fallback, unresolved recovery, both expectations,
exact statuses, retained edits and logs, mandatory retries and checkpoint behavior.

Correction remains within `packages/execution`: format the three rejected files
and remove the unused import. Under `precedence-function-standard`, retain
meaningful separated recovery functions and explanatory headers, and inspect each
function after formatting against the TypeScript standard's 30-physical-line limit.
Preserve captured authority, operation definitions, acceptance and existing
recovery responsibilities.

Preserve the existing Focus, milestone order, completed Steps and recorded activity
position. This appended correction must pass before renewed assembled acceptance
and delivery. Retain a subsequent authorized Execution owner-suite result and host
reruns of required assembled checks, including format and lint, with exact exits
and readable evidence. An unresolved required check leaves the correction pending
with edits and failed observations secured. Reuse the existing issue, branch and
single active task worktree, securing its contents before task-owned cleanup.
Resume from the recorded successor only after completion is durably recorded.

This documentation activity declares no operations and claims no corrected check
or acceptance result. The later independent reassessment, required hosted CI,
required PR review and observed staging integration remain separate gates. Preserve
reported skips and evidence limitations; earlier simulated evidence does not
establish native confinement, live inference or actual staging delivery.

[quality-candidate]: /home/adrian/.local/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/420da43f22b23e9b563b916913ddc63897341bc719a2713bf569b593233f288f/89-17-candidate.diff
[quality-format]: /home/adrian/.local/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/420da43f22b23e9b563b916913ddc63897341bc719a2713bf569b593233f288f/89-20-repository-format.log
[quality-lint]: /home/adrian/.local/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/420da43f22b23e9b563b916913ddc63897341bc719a2713bf569b593233f288f/89-21-repository-lint.log
