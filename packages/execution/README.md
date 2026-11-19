# Execution

Execution activates scoped stewards, applies checked edits and supervises declared
operations in one task worktree. Its public obligations are in the
[locked contract](contract.md).

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
