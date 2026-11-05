# Observable single-steward workflow

Current version-three execution policy is defined in [progress and limits](progress.md)
and [initialization](../task-intake/initialization.md). Initialization precedes worker
inference. There are no implicit execution or corrective quotas; the numeric limits
below describe earlier defaults or explicitly captured legacy configurations. Planned
stages and host checkpoints remain required, and repeated failures require diagnosis.

Increment two (#31) implements this contract. One Luna thread performs bounded
work. Activities are research, documentation, testing, implementation, review and
release/handoff; they are not separate agents. The host records transitions in
`activities.jsonl` and per-turn evidence in `turns/<number>/` outside the candidate.

## Minimal configuration regression evidence

Version-five components select the expected failing regression by a stable `operationId`
from captured `verify` usages. The host resolves arguments and prerequisites from
captured authority, observes the selected operation's failure, and retains its
invocation identity, definition digest, resolved context and selected test hashes.
A prerequisite failure cannot satisfy the regression expectation. Final frozen
regression checking resolves the same operation identity against captured authority.
Historical evidence using `verificationIndex` keeps its original interpretation;
new version-five execution rejects index-based expectations.

## Assignment planning

Version-2/3 execution profiles first run a source-read-only planning turn. The host
validates and retains the plan and checklist; `plan.update` records progress or a
reasoned revision during execution. Final `planUpdates` are also accepted. Agent
completion claims remain separate from mandatory host acceptance. See
[operations and evidence](../operations/steward-operations.md). Version-1 profiles retain the
original workflow below.

## Change assignments

1. **Specification:** research as needed, document intent and create a failing
   regression. Only declared documentation/test paths may change. The result
   selects a captured verification command by index, a nonzero expected exit code,
   and a literal expected assertion/test diagnostic. The host checks that failure
   and captures all changed regression files and hashes before implementation.
2. **Implementation:** edit within component ownership. The host executes project
   verification, the frozen regression against candidate implementation, and caller
   acceptance checks. Tests edited later cannot replace the frozen regression.
3. **Review/handoff:** source-read-only review of the candidate and evidence.
   Completion requires final identity, scope and verification checks. Release is
   `ready_for_integration`, not a commit, approval, merge or publication.

`changeType: "documentation"` in a structured assignment skips the red-test check;
only declared documentation paths may change and project verification still runs.
All other changes default to `changeType: "behavior"`. Missing documentation or
regression scope is a preflight error for behavior work.

Version 1 preserves the engineering stages without a planning turn. Versions 2/3
add planning. No version acquires implicit turn or corrective-attempt limits when
its fields are absent. `--max-attempts 2` explicitly allows one corrective
implementation; other positive ceilings are also supported. Specification failures
stop; scope/identity violations, invalid output, cancellation and explicit timeout
never authorize correction. Failed host checks or actionable review findings can
produce a concrete repair objective, subject to captured limits and loop guards.
All turns retain the same thread and any caller-selected overall deadline.

The regression check is selected from the immutable component command list. The
agent cannot introduce arbitrary host commands. An expected diagnostic is evidence
of a red test, not proof that the test adequately specifies the objective; caller
acceptance and review remain separate requirements. Frozen files are temporarily
restored for host regression checking, then candidate versions are restored in a
finally block. A hard interruption retains an incomplete record for inspection.

## Research, review and boundaries

`--kind research` and `--kind review` each use one source-read-only execution turn (plus planning for version 2) and may
complete without changes. Findings include evidence references, uncertainty and
consequences. No-change is still a failed outcome for change assignments.

Structured results contain status, summary, blockers, findings, activity outcomes,
regression checkpoint (or null), review findings, and boundary requests. A request
names the requesting component, required owner (or null for unknown ownership),
requested decision/interface, evidence, acceptance conditions and why current
scope cannot satisfy it. Known owner IDs must resolve in the captured catalog.
Unknown owners become architectural questions. Requests are returned to the caller;
no messaging or second agent is activated.

The report distinguishes `ready_for_integration`, `research_completed`,
`review_completed`, `blocked`, `failed`, and `no_changes`. Its lifecycle status stays
compatible with existing records. Logs retain every turn's prompt, SDK stream,
settings, result, actual diff and checks. The append-only activity journal records
started/completed/skipped/blocked/failed transitions, including host checkpoints.

Usage records preserve raw thread-cumulative counters and per-turn deltas, mark
missing/decreasing counters incomplete, and do not double count resumed turns.
Prompt bytes/hash measure ArcNexus's input, not all Codex context. Reports record
caller interventions explicitly; a zero count means no intervention was supplied
through this execution, not that no prior human planning occurred.

## Read-only revision evidence

Review turns receive a host-captured diff as untrusted evidence, with its SHA-256
and provenance retained in the turn record. A review assignment receives the pinned
base revision against its first parent (or the empty tree for a root commit), limited
to declared readable paths. The implementation-review turn receives the current
candidate diff and new-file contents. The steward does not need access to the source
repository's Git metadata; permissions remain unchanged. A review request must name
the active component as requester even when the needed decision belongs to a parent.

A sandbox-local inability to run a regression is not proof that the regression
failed correctly. The specification turn may return a completed preparation with a
proposed failing assertion/exit expectation and an evidence-backed limitation. The
host then runs the captured command and must observe that exact failure before
implementation. The steward must not claim verification it could not perform;
missing or mismatched host evidence still stops the workflow.

## Version-five checked engineering

Version-five change assignments use the ordinary persisted engineering stages and
shared operation checkpoints. Assignment resolution no longer rejects them solely
because their component uses minimal configuration. Before model execution, the
installed confinement adapter must qualify successfully; unsupported enforcement
still fails closed. The model and managed operations receive read-only source.

The assignment-bound `source.edit` tool is the only source mutation route. Planning,
research, review and handoff cannot edit. In write-enabled turns, the steward
chooses files within component ownership. Workflow checkpoints assess whether the
result satisfies the requested activity. Every edit checks ownership, file safety
and expected content before applying the batch and retaining a journal.

Captured mandatory suites also retain their owner, level and tags. Changing those
fields, removing registration or deleting a captured suite rejects the entire batch
before writing, with corrective feedback. Test-body changes and new owned suites
remain possible within stage authority; frozen regressions remain immutable. The
final host selection check still independently verifies the candidate. New suites
must also have the literal `registerSuite({ component, level, tags })` declaration,
name their owner, and match the captured package test root and level directory.
Malformed new registrations receive corrective feedback before any batch writes;
support files retain their normal discovery exclusion.

Qualification must retain actual model tool observations, edit receipts, expected
failing regression output, passing host checks, independent assessment and the
candidate diff. Enabling resolution or passing deterministic tests alone does not
establish the live checked-engineering gate.

A stale expected hash or create/delete precondition rejected before journaling is a
recoverable edit-tool result. It reports rejection without writing any member of the
batch; the worker must reread exact bytes and submit a corrected request. It does not
abort an otherwise valid turn. Authority violations and uncertain journal/filesystem
recovery remain fatal and never fall back to direct writes or unconditional overwrite.

A stale rejection includes the authorized path, submitted hash and currently observed
hash. These identify a mismatch precisely without returning another owner's bytes.
The worker must still inspect the file and preserve the expected-hash precondition;
the host rechecks it on every corrected request. Rejection never creates a transaction.

Edit IDs identify transactions, not owners or assignments. A distinct batch uses a
fresh unique ID; only an identical retry may reuse one. Reusing an existing ID with
different changes returns a recoverable rejection before writing anything, while the
original journal and receipt remain immutable. A corrected batch with a fresh ID still
passes full authority, hash and recovery checks. An original committed retry returns
its original receipt without replaying edits over subsequent changes.

For minimal components, engineering context explicitly describes the checked write
route before the first turn. Native patch and shell writes to maintained source are
intentionally unavailable. Stewards discover `source.edit` on the ArcNexus MCP server,
read current bytes, compute their SHA-256 hashes and submit a fresh transaction identity
for each distinct batch. An identical retry may reuse that identity. The same context
enforces component ownership and read-only activities: planning, coordination, research and
review do not gain source-edit permission merely because the tool is discoverable.
A denied native write is not evidence that the checked edit route is unavailable.

Checked edit paths are relative to the assignment workspace, never absolute paths.
Context and tool metadata must state this explicitly; a displayed absolute workspace
location is for reading and command context, not the spelling of `changes[].path`.


Implementation and corrective turns must list the current frozen regression paths
and digests. The host retains the original regression bytes outside the candidate
and runs frozen checks independently. Changing an owned candidate test cannot
replace that baseline. Turn context reflects the latest accepted checkpoint.

Candidate review retains the full Git-base diff and separately reports
`frozenRegressions` comparisons against the accepted checkpoint. `preserved` means
current bytes match the frozen hash, even if specification work changed that file
before freezing. It does not mean the test establishes acceptance or has good
quality. Missing and changed files are explicit; unsafe paths and corrupt retained
checkpoints fail capture. Review cannot replace the accepted baseline.

When `source.edit` rejects an attempted change to another steward's file, no file
in the batch is changed. The result identifies the path and its owner from the
captured repository catalog. For an eligible owner, return an inbox request naming
that steward, the intended change, purpose, supporting evidence, and acceptance
criteria. Use the `delivered` milestone when the assignment depends on the change.
The normal host checks and routes the request; the rejected edit itself neither
creates a dependency nor grants authority. Unknown or ambiguous owners require an
architectural decision. An ineligible steward cannot be activated by an edit error.

Choose your own implementation files within captured component ownership. Neither
a director nor an inbox requester can provide a file permission list.
