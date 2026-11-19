# Execution

Execution activates scoped stewards, applies checked edits and supervises declared
operations in one task worktree. Its public obligations are in the
[locked contract](contract.md).

## Activity-scoped operation recovery

Use the [local MCP operations guide](docs/mcp-operations.md) to check one
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

The intended caller-level recovery behavior implements EX-22 and EX-23; its
delivery still requires public regression evidence and independent verification.
A mapped local MCP check executes the captured confined command and returns its
actual exit status, exact diagnostic and immutable log before the caller
continues. The current activity owns its assigned work and can apply a single-file
checked correction and recheck within that activation. Captured mappings constrain
host operations, not ordinary public APIs used by authored code. Native shell,
unmapped operations and raw response operations remain refused.

Every unresolved check retains its original expectation. A completed response,
an omitted check, another passing check or a changed requested expectation cannot
erase that observation. Expected-failure tests keep their original expectations.
Matching completed evidence is reused without executing the same command again;
affected edits, including supplier contributions, invalidate reuse. Supplier
ownership never grants the caller permission to edit its files. The milestone,
captured authority and engineering criteria stay unchanged. A distinct failure or
changed inputs can continue correction; an unchanged diagnostic without progress
retains an actionable hold before another identical automatic attempt.

A steward self-review returns `kind: repair`, the earliest affected applicable
`activity` (`documentation`, `testing` or `implementation`), and its `reason`.
Workflow validates that rewind against the milestone and captured activity map,
then persists the target and finding with the position in one journal event.
`localRepair` is optional rewind context; when supplied, read its evidence before
correcting the finding. Its absence does not remove the current activity's
responsibility. Only affected downstream work replays. Completed single-file
receipts and complete answers stay available. Explicit cross-owner work uses Direction; final independent rejection
also returns to Direction. Ordinary local repair does not create a milestone or
invoke the Director.

Clarification, research and supplier inbox requests are optional. A request after
an observed check preserves its diagnostic and original unresolved expectation
alongside receipts and complete answers through handoff, interruption and restart.
A check completed before interruption is retained; an interrupted command without
a completed result cannot establish success. No deferred native check queue or
queued-response workaround participates in recovery.

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

## Native invocation evidence

The intended common native provider boundary records the actual submitted request
input byte count, acting component/activity and captured selected model/profile in
the existing journal before invocation (EX-24). This includes Director and local
repair calls, counts multibyte input as bytes and retains attribution on provider
failure or interruption. Request and result evidence stay in existing task
storage; no separate metrics store is needed. See the
[operation guide](docs/mcp-operations.md#native-invocation-attribution).

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
