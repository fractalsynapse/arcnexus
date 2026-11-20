# Execution

Execution activates scoped stewards, applies checked edits and supervises declared
operations in one task worktree. Its public obligations are in the
[locked contract](contract.md).

## Inspection and activation request parity

The [request parity intent](docs/request-parity.md) records EX-6's exact
Director, steward and Reviewer comparisons, live-only placeholders, native Codex
guidance discovery and the evidence limits for `activation-request-parity`.
It records intended behavior before changes and claims no passing activation result.

## Activity-scoped operation recovery

Use the [verified local MCP operations guide](docs/mcp-operations.md) to check one
file at a time, retain successful receipts and correct refusals.

The [operation and recovery proposal](https://github.com/fractalsynapse/arcnexus/issues/562)
routes project operations through the current activity's local MCP tools. The
execution provider independently controls its built-in web access. A refused
checked edit tells the requesting steward which path was refused and who owns
it. A refusal grants no authority. The steward can correct its request or
request a contribution through the existing Direction path.

The task journal retains each clarification with its requesting actor and
position. The same activation resumes with the exact answer. Reopening the task
reads the retained answer before calling the actor and preserves the candidate
and its check evidence while a Reviewer question is open. The host also gives
independent review a protected reference to the original answer, together with
its requesting component, activity and question. The evidence stays in task
storage and is reused across attempts.

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

## Local activity repair

Mapped MCP checks return their observed result before the caller continues.
A completed response cannot hide a failed check recorded during that activation;
the host reconciles unresolved observations before advancing the milestone.

Reuse requires a recorded input identity matching the current clean checkpoint,
captured operation and confined environment. Validate cancellation, confinement
and arguments before consulting earlier results. Older observations without that
identity remain evidence and are rerun. Setup events alone do not invalidate an
unchanged checkpoint, and a new worktree path does not change its contents.

Reuse includes failed numeric observations. Repeating a mapped check against the
same validated inputs returns its latest actual failure and original log, rather
than launching the expensive command again. It remains pending and cannot be
discharged by an older success. A changed checkpoint, authority, operation,
expectation, configuration or environment requires fresh evidence; missing input
provenance or a missing log prevents reuse. Cancellation and confinement are
validated first. This is the same observation cache, not another retry path (#643).
The process path creates its supplied transcript before execution, so a silent
command retains an honest empty log rather than a nonexistent evidence path (#644).

Repair context distinguishes the active activity from an earlier rewind target.
Completed Testing with an expected failure is valid red evidence for
Implementation to correct, rather than a reason to restart Testing.

An unexpected check result returns its operation ID, original expectation, exact
exit status and immutable log to the same accountable activity. The original
milestone and engineering criteria stay unchanged. The host reruns the unresolved
check even when the next response requests no checks. A distinct failure can
continue local correction; repeating the same diagnostic without changed inputs
holds before another identical automatic attempt.
Checked supplier contributions also change the task's check inputs. After that
contribution, a remaining failure returns to the original caller for local repair;
the supplier's ownership never grants the caller permission to edit its files.

Every caller-level reply retry rebuilds its assignment from the current journal.
The newest pending check supplies the diagnostic and unchanged expected outcome;
a resolved failure stays in history without remaining the current instruction.
Earlier evidence and receipts remain available. This prevents later repairs from
being directed at a syntax error after compilation has already succeeded (#642).

A steward self-review returns `kind: repair`, the earliest affected applicable
`activity` (`documentation`, `testing` or `implementation`), and its `reason`.
Workflow validates that rewind against the milestone and captured activity map,
then persists the target and finding with the position in one journal event.
The restarted activity receives `localRepair` and its evidence. Only affected
downstream work replays. Completed single-file receipts and complete answers stay
available. Explicit cross-owner work uses Direction; final independent rejection
also returns to Direction. Ordinary local repair does not create a milestone or
invoke the Director.

A model's assertion that a capability is unavailable does not establish a host
prerequisite. Return that unsupported `blocked` response and its exact reason to
the same caller for investigation through mapped tools, optional research or
explicit supplier escalation. Rephrasing the assertion without checked progress
must not create an endless retry. Actual host-observed failures and unanswered
high-level guide questions retain their normal holds.

The [check-repair scenarios](tests/integration/steward-check.test.ts) exercise
compiler and assertion repairs, unchanged failures, response repair, ownership
refusals and complete supplier answers. The
[Workflow rewind scenarios](../workflow/tests/unit/activity-repair.test.ts)
exercise each editable target and cancellation after the durable rewind.
Deterministic scenarios are distinct from live qualification.

## Checkpoints and evidence

An acknowledged MCP edit is secured before its receipt is returned. Cancellation
and ordinary termination retain checked work and remove the task-owned worktree.
Restart reconciles the branch, remote checkpoint and abandoned worktree before
resuming the first unfinished activity. Observe uncertain upstream effects before
repeating them. A retained failed check is pending until a matching observation
satisfies its original expectation; no missing feedback implies success.

Failed observations, bulk logs and transcripts remain in external application
storage. Earlier repair-by-repair development notes are retained in Git history;
the executable recovery rules are defined by the current contract and tests.
The approved Architecture and refinement capabilities in the contract remain
implementation targets until their own tests and live acceptance are reported.

For an Architect prerequisite task, the shared activation path derives the actor's
implementation and delivery goal from the actual host-verified approved proposal.
Assessment feedback stays in its original phase; it must not override the approved
implementation purpose. Direction, stewards and the independent Reviewer use this
same derivation and request builder. The canonical journal goal and task identity
remain unchanged for retry lookup, issue/branch/checkpoint reuse and honest history.
A candidate-side approval claim cannot change the activation goal. Ordinary tasks
continue to pass their supplied goal unchanged. This handoff is the bootstrap
correction tracked in #639; a real retained phase must demonstrate it after checks.

## Candidate dependencies

Confined checks must use the candidate's dependency manifest and lockfile, rather
than the original checkout's installation (#649). The host prepares npm inputs
in its existing networkless overlay, with lifecycle scripts disabled, and retains
the exact prerequisite command, status and log. A failed prerequisite returns to
the caller; the requested check has not run and cannot pass.

Prepared dependencies live in external application storage and are read-only to
checks. Reuse binds their identity to the candidate's manifest, lockfile, npm
configuration and runtime. Local dependency inputs conservatively bind to the
candidate revision. Interrupted preparation is discarded before retry; successful
source edits, answers and check observations remain in the journal. The existing
npm cache supplies packages offline; an unavailable package is an observed failure,
never permission to use ambient dependencies or enable network access.

A local rewind does not erase earlier genuine red evidence or completed
Implementation. The current cursor describes remaining work; prior completion
and its observed checks remain readable separately (#651). Behavior-preserving
corrections may characterize the implemented candidate with passing checks, as
the Designer role permits. Do not manufacture a failing assertion to advance.

A caller's requested check outcome is a prediction, distinct from captured goal
acceptance. When a requested failure actually passes, the caller may correct that
prediction to expected-pass. The journal retains the original request and result,
records their correction link, and keeps a required current passing recheck even
across interruption. This neither invents initial red nor approves a criterion.
An actual failure of a required-pass check cannot become expected-red. Captured
criteria, ownership, operations and independent assembled verification remain
unchanged. Use the same caller repair for Testing and Implementation; no phase
exception or separate recovery lifecycle is needed.

A passing prediction during Testing must not erase an already observed expected-red
regression. Testing may correct that prediction only when the actual failing
command has the same diagnostics as retained red under the same milestone,
acceptance and captured authority. The host retains both requests and results and
requires another real check. New failures, missing evidence and dependency setup
failures do not qualify. Implementation and assembled passing checks remain
mandatory; this is classification of existing red, not acceptance of broken code
(#652).

Execution validates model-requested repair targets with Workflow's same target
validator before accepting the response. An unavailable or forward target returns
the diagnostic and available rewind choices to the caller. It does not checkpoint
the malformed response, skip unfinished Steps, or invoke Direction (#653).

On restart, a retained malformed repair target resumes the original caller at its
unchanged cursor. It never executes the invalid transition or rewrites the failed
observation. Previously valid repair transitions still replay normally (#653).

## Focused retained evidence

Steward requests reference a complete immutable evidence index in existing task
storage instead of repeating every historical artifact path. Current assignments
still carry exact pending diagnostics, complete answers, research and acceptance.
Mapped reads can follow the index to any retained observation; index artifacts do
not recursively index themselves. Returning callers add newly observed artifacts
while preserving their explicit inputs and complete inbox answers. Initial explicit
activation context remains unchanged for inspection/harness parity (#650).

Unfinished assigned work is not an unavailable prerequisite. Continue the current
activity's mapped operations until its checklist is met, request optional research
for missing knowledge, or explicitly escalate a distinct ownership contribution.
A progress report must not end the activity as blocked merely because work remains.

## Recovering acknowledged deletions

A mapped read of an absent project file may identify its latest acknowledged
checked deletion. The host reads that checkpoint's exact parent blob, verifies
the recorded before digest and retains the source as an immutable task artifact.
The operation still reports that the live file is absent, names the historical
artifact and states that a restoration requires a new owned checked edit with
`expected: null`. It never substitutes historical text for current contents or
restores source automatically. Unknown paths, uncheckpointed deletions and
mismatched evidence remain refusals. All ordinary path and write guards remain
in force (#655).

Every steward activity receives `repairTargets` from Workflow's canonical target
validator. An earlier applicable activity may be selected by Implementation as
well as self-review: intent corrections belong in Documentation, incorrect
assertions or fixture assumptions in Testing, and code corrections in
Implementation. A local rewind keeps the unresolved check, accepted milestone,
owner and criteria; it adds no Director call or new milestone. Review and Release
are not editable rewind targets (#656).

Model-directed rewinds select an earlier applicable editable activity. The current
activity is already running: it must continue its mapped work rather than return
a self-repair progress report. That redundant response returns an exact diagnostic
to the same caller through existing response validation. Host-generated recovery
from an actual failed check can still revisit the current activity (#657).

Research handoffs validate required fields before MCP acknowledges them. Requests
and reports have no application-imposed character or item caps. Preserve complete
questions, decisions, findings, references and archived metadata. Invalid structure
returns to the caller for correction without losing acknowledged work. Retained
requests rejected only by removed limits resume normally (#658, #659).
